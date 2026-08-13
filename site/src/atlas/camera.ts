// Orbit camera and the fly-to animation.
//
// The camera orbits a target point rather than panning a plane, which is what
// gives the graph depth: rotating around it reveals that the layout is a volume
// and not a picture of one.

export type Camera = {
  /** Point the camera looks at and orbits around. */
  tx: number;
  ty: number;
  tz: number;
  /** Distance from the target. Scroll changes this. */
  distance: number;
  /** Horizontal orbit angle, radians. */
  azimuth: number;
  /** Vertical orbit angle, radians. Clamped short of the poles. */
  elevation: number;
};

const MIN_DISTANCE = 0.55;
const MAX_DISTANCE = 6.5;
/** Just short of vertical — at the poles the up vector degenerates. */
const MAX_ELEVATION = 1.35;

export const FOV = (46 * Math.PI) / 180;

export function defaultCamera(): Camera {
  return {
    tx: 0,
    ty: 0,
    tz: 0,
    // Far enough back that the whole graph is framed with margin; the layout is
    // normalised into the unit box, so this is stable across content changes.
    distance: 4.3,
    azimuth: 0.42,
    elevation: 0.26,
  };
}

export function clampDistance(d: number): number {
  return Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, d));
}

export function clampElevation(e: number): number {
  return Math.min(MAX_ELEVATION, Math.max(-MAX_ELEVATION, e));
}

function eyePosition(c: Camera): [number, number, number] {
  const ce = Math.cos(c.elevation);
  return [
    c.tx + c.distance * ce * Math.sin(c.azimuth),
    c.ty + c.distance * Math.sin(c.elevation),
    c.tz + c.distance * ce * Math.cos(c.azimuth),
  ];
}

/** Column-major 4x4, the layout WebGL expects. */
export function viewProjection(
  c: Camera,
  aspect: number,
  out: Float32Array
): Float32Array {
  const eye = eyePosition(c);

  // --- view (lookAt) ---
  let zx = eye[0] - c.tx;
  let zy = eye[1] - c.ty;
  let zz = eye[2] - c.tz;
  const zl = Math.hypot(zx, zy, zz) || 1;
  zx /= zl;
  zy /= zl;
  zz /= zl;

  // up = (0,1,0); elevation is clamped so this never degenerates
  let xx = 1 * zz - 0 * zy;
  let xy = 0 * zx - 0 * zz;
  let xz = 0 * zy - 1 * zx;
  const xl = Math.hypot(xx, xy, xz) || 1;
  xx /= xl;
  xy /= xl;
  xz /= xl;

  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  // --- projection (perspective) ---
  const f = 1 / Math.tan(FOV / 2);
  const near = 0.02;
  const far = 60;
  const nf = 1 / (near - far);
  const p0 = f / aspect;
  const p5 = f;
  const p10 = (far + near) * nf;
  const p14 = 2 * far * near * nf;

  // view matrix entries
  const v0 = xx;
  const v1 = yx;
  const v2 = zx;
  const v4 = xy;
  const v5 = yy;
  const v6 = zy;
  const v8 = xz;
  const v9 = yz;
  const v10 = zz;
  const v12 = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  const v13 = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  const v14 = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);

  // out = proj * view, expanded (proj is sparse)
  out[0] = p0 * v0;
  out[1] = p5 * v1;
  out[2] = p10 * v2;
  out[3] = -v2;
  out[4] = p0 * v4;
  out[5] = p5 * v5;
  out[6] = p10 * v6;
  out[7] = -v6;
  out[8] = p0 * v8;
  out[9] = p5 * v9;
  out[10] = p10 * v10;
  out[11] = -v10;
  out[12] = p0 * v12;
  out[13] = p5 * v13;
  out[14] = p10 * v14 + p14;
  out[15] = -v14;
  return out;
}

/** World point -> clip space, using the same matrix the shaders get. */
export function projectPoint(
  m: Float32Array,
  x: number,
  y: number,
  z: number,
  out: { x: number; y: number; w: number }
): void {
  out.x = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
  out.y = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
  out.w = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!;
}

// --- flight ---------------------------------------------------------------

export type Flight = {
  from: Camera;
  to: Camera;
  duration: number;
  startedAt: number;
};

/**
 * Interpolates the orbit parameters rather than the eye position, so the camera
 * swings around the graph instead of cutting through it. Distance is
 * interpolated logarithmically — linear distance reads as an abrupt lurch.
 */
export function planFlight(from: Camera, to: Camera, now: number): Flight {
  // Take the short way round the circle.
  let d = to.azimuth - from.azimuth;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const target: Camera = { ...to, azimuth: from.azimuth + d };

  const travel = Math.hypot(
    target.tx - from.tx,
    target.ty - from.ty,
    target.tz - from.tz
  );
  const zoomChange = Math.abs(Math.log(target.distance / from.distance));
  const effort = travel * 0.8 + Math.abs(d) * 0.35 + zoomChange * 0.5;

  return {
    from,
    to: target,
    // The ceiling has to cover the longest flight there is — half a turn, from
    // a term at the back of the volume to the front. At the old 1100ms bound a
    // half-turn and a nudge took the same time, so the long ones read as a
    // whip-round rather than the map being turned.
    duration: Math.min(1500, Math.max(520, 420 + effort * 620)),
    startedAt: now,
  };
}

export function sampleFlight(f: Flight, t: number, out: Camera): void {
  const k = Math.min(1, Math.max(0, t));
  out.tx = f.from.tx + (f.to.tx - f.from.tx) * k;
  out.ty = f.from.ty + (f.to.ty - f.from.ty) * k;
  out.tz = f.from.tz + (f.to.tz - f.from.tz) * k;
  out.azimuth = f.from.azimuth + (f.to.azimuth - f.from.azimuth) * k;
  out.elevation = f.from.elevation + (f.to.elevation - f.from.elevation) * k;
  out.distance = f.from.distance * Math.pow(f.to.distance / f.from.distance, k);
}

/** --ease-gleasing, cubic-bezier(.4, 0, 0, 1), so canvas and CSS agree. */
export function easeGleasing(t: number): number {
  return cubicBezier(0.4, 0, 0, 1, t);
}

function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number
): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = -6 * x1 + 3 * x2;
  const cx = 3 * x1;
  let t = x;
  for (let i = 0; i < 6; i++) {
    const fx = ((ax * t + bx) * t + cx) * t - x;
    const dfx = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(dfx) < 1e-7) break;
    t -= fx / dfx;
  }
  t = Math.min(1, Math.max(0, t));
  const ay = 3 * y1 - 3 * y2 + 1;
  const by = -6 * y1 + 3 * y2;
  const cy = 3 * y1;
  return ((ay * t + by) * t + cy) * t;
}
