// Node positions in 3D, computed at build time and committed to
// internal/layout.lock.json.
//
// Build time rather than runtime because an atlas is only useful if it is the
// same place on every visit — spatial memory is the whole point. A committed
// lockfile also means positions are a reviewed artifact you can diff, and that
// CI never runs a simulation, which is what makes the freshness check
// deterministic.
//
// The solver is hand-written rather than d3-force because d3's internals
// (quadtree, forceX/forceY) are two-dimensional. At 84 nodes the naive
// all-pairs form is ~3.5k interactions per tick, which is nothing, and it keeps
// the whole thing deterministic and dependency-free.

import type { Edge } from "./graph.js";
import type { Section } from "./curriculum.js";

export const LOCK_VERSION = 2;
export const DEFAULT_SEED = 0xa71a5;

const COLD_TICKS = 900;
const INCREMENTAL_TICKS = 220;

export type Vec3 = [number, number, number];

export type Lock = {
  version: number;
  seed: number;
  positions: Record<string, Vec3>;
};

export type LayoutMode = "locked" | "incremental" | "cold";

export type LayoutResult = {
  positions: { x: number; y: number; z: number }[];
  lock: Lock;
  mode: LayoutMode;
  added: string[];
};

/** Deterministic PRNG. Nothing in this file may touch Math.random. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Section anchors spread over a sphere rather than a circle, so sections become
 * territories in depth as well as across the frame. A Fibonacci sphere gives
 * near-uniform spacing for any count without hand-placing them.
 */
function sectionAnchors(count: number): Vec3[] {
  const R = 360;
  if (count <= 1) return [[0, 0, 0]];
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    return [Math.cos(theta) * r * R, y * R * 0.72, Math.sin(theta) * r * R];
  });
}

export function computeLayout(
  terms: string[],
  sections: Section[],
  edges: Edge[],
  degrees: number[],
  lock: Lock | null,
  opts: { relayout?: boolean } = {}
): LayoutResult {
  if (terms.length === 0) {
    return {
      positions: [],
      lock: { version: LOCK_VERSION, seed: DEFAULT_SEED, positions: {} },
      mode: "locked",
      added: [],
    };
  }

  const sectionOf = new Map<string, number>();
  sections.forEach((s, i) => s.terms.forEach((t) => sectionOf.set(t, i)));
  const anchors = sectionAnchors(Math.max(sections.length, 1));

  const locked = lock?.positions ?? {};
  const added = terms.filter((t) => !locked[t]);
  const cold = opts.relayout || !lock || lock.version !== LOCK_VERSION;

  // Fast path: everything is already placed. No simulation, ~instant, and the
  // path that pre-commit and CI take.
  if (!cold && added.length === 0) {
    return {
      positions: terms.map((t) => {
        const p = locked[t]!;
        return { x: p[0], y: p[1], z: p[2] };
      }),
      lock: { version: LOCK_VERSION, seed: lock!.seed, positions: locked },
      mode: "locked",
      added: [],
    };
  }

  const seed = cold ? DEFAULT_SEED : (lock?.seed ?? DEFAULT_SEED);
  const random = mulberry32(seed);
  const n = terms.length;
  const SCALE = 420;

  const px = new Float64Array(n);
  const py = new Float64Array(n);
  const pz = new Float64Array(n);
  const vx = new Float64Array(n);
  const vy = new Float64Array(n);
  const vz = new Float64Array(n);
  const sec = new Int32Array(n);
  const radius = new Float64Array(n);

  terms.forEach((term, i) => {
    const s = sectionOf.get(term) ?? 0;
    sec[i] = Math.min(s, anchors.length - 1);
    radius[i] = 12 + 2.2 * Math.sqrt(degrees[i] ?? 0);
    const prior = cold ? undefined : locked[term];
    if (prior) {
      px[i] = prior[0] * SCALE;
      py[i] = prior[1] * SCALE;
      pz[i] = prior[2] * SCALE;
    } else {
      // Seeded jitter around the section anchor: deterministic, and a new term
      // lands near its own section rather than at the origin with everything else.
      const a = anchors[sec[i]!]!;
      const h = hash(term);
      px[i] = a[0] + ((h & 255) / 255 - 0.5) * 120;
      py[i] = a[1] + (((h >> 8) & 255) / 255 - 0.5) * 120;
      pz[i] = a[2] + (((h >> 16) & 255) / 255 - 0.5) * 120;
    }
  });

  // Layout on the backbone only. Feeding the full edge set makes the springs
  // pull against the section anchors and the whole thing collapses to a ball.
  const links = edges.filter((e) => e.t === 1);

  const anchorK = cold ? 0.055 : 0.02;
  const retainK = cold ? 0 : 0.06;
  const ticks = cold ? COLD_TICKS : INCREMENTAL_TICKS;

  const prior: (Vec3 | undefined)[] = terms.map((t) =>
    cold ? undefined : locked[t]
  );

  for (let step = 0; step < ticks; step++) {
    const alpha = 1 - step / ticks;
    const damping = 0.62;

    // Repulsion, all pairs. Mild relative to the anchors on purpose — tuned
    // higher, hub repulsion overwhelms them and the sections smear together.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = px[j]! - px[i]!;
        let dy = py[j]! - py[i]!;
        let dz = pz[j]! - pz[i]!;
        let d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 1e-6) {
          dx = (random() - 0.5) * 0.1;
          dy = (random() - 0.5) * 0.1;
          dz = (random() - 0.5) * 0.1;
          d2 = dx * dx + dy * dy + dz * dz + 1e-6;
        }
        const d = Math.sqrt(d2);
        const strength =
          (2600 + 90 * ((degrees[i] ?? 0) + (degrees[j] ?? 0))) / d2;
        const f = (strength * alpha) / d;
        vx[i]! -= dx * f;
        vy[i]! -= dy * f;
        vz[i]! -= dz * f;
        vx[j]! += dx * f;
        vy[j]! += dy * f;
        vz[j]! += dz * f;

        // Collision: keep discs from overlapping once things settle.
        const min = radius[i]! + radius[j]!;
        if (d < min) {
          const push = ((min - d) / d) * 0.35;
          vx[i]! -= dx * push;
          vy[i]! -= dy * push;
          vz[i]! -= dz * push;
          vx[j]! += dx * push;
          vy[j]! += dy * push;
          vz[j]! += dz * push;
        }
      }
    }

    // Springs along the backbone. Stronger similarity pulls tighter and shorter.
    for (const e of links) {
      const a = e.a;
      const b = e.b;
      const dx = px[b]! - px[a]!;
      const dy = py[b]! - py[a]!;
      const dz = pz[b]! - pz[a]!;
      const d = Math.hypot(dx, dy, dz) || 1e-6;
      const target = 46 + 96 * (1 - e.w);
      const k = (0.16 + 0.34 * e.w) * alpha;
      const f = ((d - target) / d) * k;
      vx[a]! += dx * f;
      vy[a]! += dy * f;
      vz[a]! += dz * f;
      vx[b]! -= dx * f;
      vy[b]! -= dy * f;
      vz[b]! -= dz * f;
    }

    // Section anchors, and (incremental only) a pull back toward locked spots.
    for (let i = 0; i < n; i++) {
      const a = anchors[sec[i]!]!;
      vx[i]! += (a[0] - px[i]!) * anchorK * alpha;
      vy[i]! += (a[1] - py[i]!) * anchorK * alpha;
      vz[i]! += (a[2] - pz[i]!) * anchorK * alpha;

      const p = prior[i];
      if (p && retainK > 0) {
        vx[i]! += (p[0] * SCALE - px[i]!) * retainK * alpha;
        vy[i]! += (p[1] * SCALE - py[i]!) * retainK * alpha;
        vz[i]! += (p[2] * SCALE - pz[i]!) * retainK * alpha;
      }
    }

    for (let i = 0; i < n; i++) {
      vx[i]! *= damping;
      vy[i]! *= damping;
      vz[i]! *= damping;
      px[i]! += vx[i]!;
      py[i]! += vy[i]!;
      pz[i]! += vz[i]!;
    }
  }

  const positions = canonicalise(px, py, pz, sec);

  const outLock: Lock = {
    version: LOCK_VERSION,
    seed,
    positions: Object.fromEntries(
      terms.map((t, i) => [
        t,
        [
          round(positions[i]!.x),
          round(positions[i]!.y),
          round(positions[i]!.z),
        ] as Vec3,
      ])
    ),
  };

  return {
    positions: positions.map((p) => ({
      x: round(p.x),
      y: round(p.y),
      z: round(p.z),
    })),
    lock: outLock,
    mode: cold ? "cold" : "incremental",
    added,
  };
}

/**
 * A force layout is only defined up to translation, rotation and reflection.
 * Without pinning those down, two geometrically identical runs differ on every
 * node — which trains everyone to ignore layout diffs, defeating the lockfile.
 *
 * Centre, then rotate so the widest spread lies along X and the next widest
 * along Y (so the default camera sees the broadest face), then fix the sign
 * using section 0, then normalise into the unit box.
 */
function canonicalise(
  px: Float64Array,
  py: Float64Array,
  pz: Float64Array,
  sec: Int32Array
): { x: number; y: number; z: number }[] {
  const n = px.length;
  const pts: Vec3[] = [];
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < n; i++) {
    cx += px[i]!;
    cy += py[i]!;
    cz += pz[i]!;
  }
  cx /= n;
  cy /= n;
  cz /= n;
  for (let i = 0; i < n; i++) pts.push([px[i]! - cx, py[i]! - cy, pz[i]! - cz]);

  // Power iteration for the principal axis, then again in the plane orthogonal
  // to it for the second. Deterministic: fixed start vector, fixed iterations.
  const axis1 = principalAxis(pts, [1, 0, 0]);
  const rejected = pts.map((p) => reject(p, axis1));
  const axis2n = principalAxis(rejected, [0, 1, 0]);
  const axis2 = normalize(reject(axis2n, axis1));
  const axis3 = cross(axis1, axis2);

  let out = pts.map((p) => ({
    x: dot(p, axis1),
    y: dot(p, axis2),
    z: dot(p, axis3),
  }));

  // Reflect so section 0 always lands on the same side of each axis.
  const first = out.filter((_, i) => sec[i] === 0);
  const ref = first.length ? first : out;
  const mean = (f: (v: { x: number; y: number; z: number }) => number) =>
    ref.reduce((s, v) => s + f(v), 0) / ref.length;
  const sx = mean((v) => v.x) > 0 ? -1 : 1;
  const sy = mean((v) => v.y) > 0 ? -1 : 1;
  const sz = mean((v) => v.z) > 0 ? -1 : 1;
  out = out.map((v) => ({ x: v.x * sx, y: v.y * sy, z: v.z * sz }));

  const extent = Math.max(
    ...out.map((v) => Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z))),
    1e-6
  );
  return out.map((v) => ({
    x: v.x / extent,
    y: v.y / extent,
    z: v.z / extent,
  }));
}

function principalAxis(pts: Vec3[], start: Vec3): Vec3 {
  let v = normalize(start);
  for (let iter = 0; iter < 32; iter++) {
    let ax = 0;
    let ay = 0;
    let az = 0;
    for (const p of pts) {
      const d = dot(p, v);
      ax += p[0] * d;
      ay += p[1] * d;
      az += p[2] * d;
    }
    const next: Vec3 = [ax, ay, az];
    if (Math.hypot(ax, ay, az) < 1e-9) return v;
    v = normalize(next);
  }
  return v;
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function reject(p: Vec3, axis: Vec3): Vec3 {
  const d = dot(p, axis);
  return [p[0] - axis[0] * d, p[1] - axis[1] * d, p[2] - axis[2] * d];
}

function round(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}
