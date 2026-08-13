// Instanced SDF discs, billboarded in 3D. One draw call for every node.
//
// Quads rather than gl.POINTS: point size caps around 64px on some drivers, and
// points clip out entirely once their centre leaves the frustum — both fatal
// for a map you fly into.
//
// Everything that changes on hover or selection is a uniform compared against
// the per-instance index, so no buffer is ever re-uploaded.
//
// Nodes carry no section colour. A term's section is expressed by the colour of
// the whole page while that term is open, not by tinting eighty-four dots.

import { GLSL_COMMON } from "./common";

export const NODE_VERT = /* glsl */ `#version 300 es
precision highp float;

in vec2 aCorner;    // per-vertex, [-1,1]
in vec3 aPos;       // per-instance, world
in float aRadius;   // per-instance, world units
in float aIndex;
in float aStatus;   // 1 = published, 0 = draft

uniform mat4 uViewProj;
uniform vec2 uHalfPx;    // half viewport, device px
uniform float uProjScale; // device px per world unit at w = 1
uniform float uDpr;
uniform float uTime;
uniform float uDrift;
uniform float uHover;
uniform float uFocus;
uniform float uFadeNear;
uniform float uFadeFar;

out vec2 vUv;
out float vStatus;
out float vState;   // 0 idle, 1 hover, 2 focus
out float vRad;     // device px
out float vQuad;    // device px
out float vFade;

${GLSL_COMMON}

void main() {
  vec3 p = drift(aPos, phaseOf(aIndex), uDrift, uTime);
  vec4 clip = uViewProj * vec4(p, 1.0);

  // Behind the camera: push off-screen rather than letting it wrap around.
  if (clip.w <= 0.001) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    vUv = vec2(2.0);
    vRad = 0.0; vQuad = 1.0; vFade = 0.0;
    vStatus = aStatus; vState = 0.0;
    return;
  }

  float state = 0.0;
  if (uFocus >= 0.0 && abs(aIndex - uFocus) < 0.5) state = 2.0;
  else if (uHover >= 0.0 && abs(aIndex - uHover) < 0.5) state = 1.0;

  // True perspective size, then clamped so distant nodes stay visible and near
  // ones stop ballooning.
  float rpx = aRadius * uProjScale / clip.w;
  rpx = clamp(rpx, 1.7 * uDpr, 15.0 * uDpr);
  if (state > 0.5) rpx *= 1.25;

  float quad = rpx + 3.0 * uDpr;   // room for halo and antialiased edge

  // Offset in NDC, then multiply back through w so the perspective divide
  // leaves the billboard exactly the intended pixel size.
  vec2 ndc = clip.xy / clip.w;
  vec2 offset = aCorner * vec2(quad / uHalfPx.x, quad / uHalfPx.y);
  gl_Position = vec4((ndc + offset) * clip.w, clip.z, clip.w);

  vUv = aCorner;
  vStatus = aStatus;
  vState = state;
  vRad = rpx;
  vQuad = quad;
  vFade = depthFade(clip.w, uFadeNear, uFadeFar);
}
`;

export const NODE_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
in float vStatus;
in float vState;
in float vRad;
in float vQuad;
in float vFade;

uniform vec3 uInk;
uniform vec3 uPaper;
uniform float uDim;
uniform float uDpr;

out vec4 outColor;

void main() {
  float d = length(vUv) * vQuad;
  float aa = uDpr;

  // A paper-coloured halo just outside the disc. Without it, nodes at different
  // depths merge into one blob and the edges underneath muddy their outline.
  float halo = vRad + 2.0 * uDpr;
  float inHalo = 1.0 - smoothstep(halo - aa, halo + aa, d);
  if (inHalo <= 0.003) discard;

  float inDisc = 1.0 - smoothstep(vRad - aa, vRad + aa, d);

  // Draft terms — curriculum entries with no file yet — render as hollow rings.
  if (vStatus < 0.5) {
    float innerR = max(vRad - 1.5 * uDpr, 0.0);
    inDisc *= max(smoothstep(innerR - aa, innerR + aa, d), 0.08);
  }

  vec3 color = mix(uPaper, uInk, inDisc);

  float dim = vState > 0.5 ? 1.0 : uDim;
  float a = inHalo * dim * mix(vFade, 1.0, vState > 0.5 ? 1.0 : 0.0);

  outColor = vec4(color * a, a);   // premultiplied
}
`;
