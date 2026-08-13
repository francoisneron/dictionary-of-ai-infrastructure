// Instanced 3D bezier ribbons, plus the particles that travel along them.
//
// Not gl.LINES: that gives 1px only, with no width control and no antialiasing.
// A ribbon is a triangle strip swept along the curve and offset along the
// screen-space normal, so stroke width stays constant however the camera moves.
//
// The two-tier alpha is what stops 670 edges reading as a hairball. Idle shows
// only the ~190-edge backbone; a node's full set fades in when it is hovered or
// selected. Both come from uniforms compared against the per-instance endpoint
// indices, so hovering re-uploads nothing.

import { GLSL_COMMON } from "./common";

export const EDGE_VERT = /* glsl */ `#version 300 es
precision highp float;

in vec2 aSeg;      // per-vertex: (t along curve, side ∈ {-1,+1})
in vec3 aP0;
in vec3 aP1;
in float aA;
in float aB;
in float aCurve;   // outward bow, fraction of edge length
in float aW;       // cosine weight 0..1
in float aTier;    // 1 = backbone, 0 = secondary

uniform mat4 uViewProj;
uniform vec2 uHalfPx;
uniform float uDpr;
uniform float uTime;
uniform float uDrift;
uniform float uHover;
uniform float uFocus;
uniform float uBackboneAlpha;
uniform float uSecondaryAlpha;
uniform float uEgoAlpha;
uniform float uDim;
uniform float uFadeNear;
uniform float uFadeFar;

out float vAlpha;
out float vDist;
out float vHalf;

${GLSL_COMMON}

void main() {
  float t = aSeg.x;
  float side = aSeg.y;

  vec3 a = drift(aP0, phaseOf(aA), uDrift, uTime);
  vec3 b = drift(aP1, phaseOf(aB), uDrift, uTime);
  vec3 ctrl = edgeControl(a, b, aCurve);

  vec3 pos = quadBezier(a, ctrl, b, t);
  vec3 tan3 = quadTangent(a, ctrl, b, t);

  vec4 clip = uViewProj * vec4(pos, 1.0);
  if (clip.w <= 0.001) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    vAlpha = 0.0; vDist = 0.0; vHalf = 1.0;
    return;
  }

  // Screen-space normal: project a point a little further along the tangent and
  // take the perpendicular of the screen delta. Doing this in screen space is
  // what keeps stroke width independent of depth and camera angle.
  vec4 clipT = uViewProj * vec4(pos + normalize(tan3) * 0.02, 1.0);
  vec2 s0 = (clip.xy / clip.w) * uHalfPx;
  vec2 s1 = (clipT.xy / max(clipT.w, 0.001)) * uHalfPx;
  vec2 dir = s1 - s0;
  float dl = length(dir);
  vec2 nrm = dl > 0.0001 ? vec2(-dir.y, dir.x) / dl : vec2(0.0, 1.0);

  float stroke = mix(0.75, 1.3, aTier) * uDpr;
  float halfStroke = stroke * 0.5;
  float pad = halfStroke + 0.9 * uDpr;

  vec2 screen = s0 + nrm * pad * side;
  vec2 ndc = screen / uHalfPx;
  gl_Position = vec4(ndc * clip.w, clip.z, clip.w);

  float ego = 0.0;
  if (uHover >= 0.0 && (abs(aA - uHover) < 0.5 || abs(aB - uHover) < 0.5)) ego = 1.0;
  if (uFocus >= 0.0 && (abs(aA - uFocus) < 0.5 || abs(aB - uFocus) < 0.5)) ego = 1.0;

  float base = mix(uSecondaryAlpha, uBackboneAlpha * (0.6 + 0.4 * aW), aTier);
  base *= uDim;

  vAlpha = max(base, ego * uEgoAlpha) * depthFade(clip.w, uFadeNear, uFadeFar);
  vDist = pad * side;
  vHalf = halfStroke;
}
`;

export const EDGE_FRAG = /* glsl */ `#version 300 es
precision highp float;

in float vAlpha;
in float vDist;
in float vHalf;

uniform vec3 uInk;
uniform float uDpr;

out vec4 outColor;

void main() {
  if (vAlpha <= 0.002) discard;
  float edge = 1.0 - smoothstep(vHalf - 0.5 * uDpr, vHalf + 0.5 * uDpr, abs(vDist));
  float a = vAlpha * edge;
  if (a <= 0.002) discard;
  outColor = vec4(uInk * a, a);
}
`;

// --- particles -------------------------------------------------------------

/**
 * Dots travelling along the selected node's edges. They make the direction of a
 * relationship visible — signal leaving the term you selected and arriving at
 * the ones it connects to — which a static line cannot show.
 *
 * Every edge carries particle instances; a uniform decides which are visible,
 * so selection changes nothing in memory.
 */
export const PARTICLE_VERT = /* glsl */ `#version 300 es
precision highp float;

in vec2 aCorner;
in vec3 aP0;
in vec3 aP1;
in float aA;
in float aB;
in float aCurve;
in float aOffset;   // 0..1 stagger along the edge

uniform mat4 uViewProj;
uniform vec2 uHalfPx;
uniform float uProjScale;
uniform float uDpr;
uniform float uTime;
uniform float uDrift;
uniform float uNode;    // whichever node is lit: selected or hovered
uniform float uSpeed;
uniform float uFadeNear;
uniform float uFadeFar;

out vec2 vUv;
out float vAlpha;

${GLSL_COMMON}

void main() {
  // Only the lit node's edges carry visible particles, and they always run
  // outward from it, so the start is whichever endpoint that is.
  float isActive = 0.0;
  float fromA = 1.0;
  if (uNode >= 0.0) {
    if (abs(aA - uNode) < 0.5) { isActive = 1.0; fromA = 1.0; }
    else if (abs(aB - uNode) < 0.5) { isActive = 1.0; fromA = 0.0; }
  }

  if (isActive < 0.5) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    vUv = vec2(2.0); vAlpha = 0.0;
    return;
  }

  vec3 a = drift(aP0, phaseOf(aA), uDrift, uTime);
  vec3 b = drift(aP1, phaseOf(aB), uDrift, uTime);
  vec3 ctrl = edgeControl(a, b, aCurve);

  float t = fract(uTime * uSpeed + aOffset);
  // Run the parameter backwards when the selected node is the far endpoint.
  float tt = mix(1.0 - t, t, fromA);

  vec3 pos = quadBezier(a, ctrl, b, tt);
  vec4 clip = uViewProj * vec4(pos, 1.0);
  if (clip.w <= 0.001) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    vUv = vec2(2.0); vAlpha = 0.0;
    return;
  }

  float rpx = clamp(0.008 * uProjScale / clip.w, 1.1 * uDpr, 3.6 * uDpr);
  vec2 ndc = clip.xy / clip.w;
  vec2 offset = aCorner * vec2(rpx / uHalfPx.x, rpx / uHalfPx.y);
  gl_Position = vec4((ndc + offset) * clip.w, clip.z, clip.w);

  vUv = aCorner;
  // Fade in and out at the ends so dots emerge and arrive rather than blink.
  float ends = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.88, 1.0, t));
  vAlpha = ends * depthFade(clip.w, uFadeNear, uFadeFar);
}
`;

export const PARTICLE_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
in float vAlpha;

uniform vec3 uInk;

out vec4 outColor;

void main() {
  float d = length(vUv);
  if (d > 1.0 || vAlpha <= 0.004) discard;
  float a = vAlpha * (1.0 - smoothstep(0.55, 1.0, d));
  outColor = vec4(uInk * a, a);
}
`;

/** Triangle strip along the curve: SEGMENTS spans, two vertices each. */
export const EDGE_SEGMENTS = 24;

export function edgeStripGeometry(): Float32Array {
  const verts: number[] = [];
  for (let i = 0; i <= EDGE_SEGMENTS; i++) {
    const t = i / EDGE_SEGMENTS;
    verts.push(t, -1, t, 1);
  }
  return new Float32Array(verts);
}

/** Particles travelling along each edge at once. */
export const PARTICLES_PER_EDGE = 3;
