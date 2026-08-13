// Shared GLSL. Node drift has to be identical in every program or edges detach
// from the nodes they connect — so it lives here and is textually included
// rather than reimplemented per shader.

export const GLSL_COMMON = /* glsl */ `
/** Golden-angle phase per node index: no two neighbours drift in step. */
float phaseOf(float i) {
  return i * 2.399963;
}

/**
 * A slow, small, non-repeating wander. Three incommensurate frequencies mean
 * the graph never visibly loops, and the amplitude is a fraction of the
 * smallest node gap so structure is never in doubt.
 */
vec3 drift(vec3 p, float phase, float amp, float t) {
  return p + amp * vec3(
    sin(t * 0.31 + phase),
    sin(t * 0.27 + phase * 1.7 + 1.1),
    sin(t * 0.23 + phase * 2.3 + 2.2)
  );
}

vec3 quadBezier(vec3 a, vec3 c, vec3 b, float t) {
  float mt = 1.0 - t;
  return mt * mt * a + 2.0 * mt * t * c + t * t * b;
}

vec3 quadTangent(vec3 a, vec3 c, vec3 b, float t) {
  return 2.0 * (1.0 - t) * (c - a) + 2.0 * t * (b - c);
}

/**
 * Edges bow away from the graph centre rather than along some arbitrary
 * perpendicular — in 3D there is no single sensible perpendicular, and bowing
 * outward reads consistently from every camera angle.
 */
vec3 edgeControl(vec3 a, vec3 b, float bow) {
  vec3 mid = (a + b) * 0.5;
  float len = length(b - a);
  vec3 outward = normalize(mid + vec3(0.0001, 0.0002, 0.0001));
  return mid + outward * (bow * len);
}

/**
 * Farther from the camera is fainter: the main depth cue after size.
 *
 * near/far are the actual front and back of the graph at the current camera
 * distance, not arbitrary constants — calibrated to anything wider, the whole
 * graph lands in a narrow band of the curve and the falloff is invisible.
 * Squared so the front stays crisp and the drop-off is felt toward the back.
 */
float depthFade(float w, float near, float far) {
  float t = clamp((w - near) / max(far - near, 0.001), 0.0, 1.0);
  return mix(1.0, 0.1, t * t);
}
`;
