// Deriving the term graph from cross-links.
//
// The dictionary is dense: measured on the 69-entry sibling repo, 527 unique
// edges over 69 nodes is 22.5% density with an average degree of 15.3, and only
// 33% of edges stay inside a section. Drawing all of that at once is a hairball,
// and a force layout on the raw graph smears the sections into a disc.
//
// The fix is a backbone: weight each edge by how much its endpoints' neighbour
// sets overlap, then keep only each node's strongest few. On the sibling repo
// that inverts the section ratio (33% -> 55% intra-section) while keeping the
// graph connected. The backbone drives the layout and the idle render; the full
// edge set is still shipped and revealed per-node on hover.

import { linkTargets, fail, type Entry } from "./entries.js";

/** How many strongest edges each node contributes to the backbone. */
const BACKBONE_K = 3;
/** How many neighbours the entry panel lists as "related". */
const RELATED_N = 6;

export type Edge = {
  /** Dense node indices, always a < b. */
  a: number;
  b: number;
  /** Neighbourhood cosine similarity, 0..1. */
  w: number;
  /** 1 = backbone, 0 = secondary. */
  t: 0 | 1;
  /** Signed curvature offset, filled in by assignCurvature once positions exist. */
  c: number;
};

export type GraphNode = {
  index: number;
  term: string;
  degree: number;
  related: number[];
  outbound: number[];
  inbound: number[];
};

export type Graph = { nodes: GraphNode[]; edges: Edge[] };

/**
 * Builds the graph from entry bodies. `terms` is curriculum order, which
 * becomes the dense index space used by every GL buffer downstream.
 * Entries missing from `entries` are draft nodes with no outbound links.
 */
export function buildGraph(
  terms: string[],
  entries: Map<string, Entry>
): Graph {
  const indexOf = new Map(terms.map((t, i) => [t, i]));

  // Directed adjacency, deduped — a term linked twice in one entry is one edge.
  const outbound: Set<number>[] = terms.map(() => new Set());
  const inbound: Set<number>[] = terms.map(() => new Set());

  terms.forEach((term, i) => {
    const entry = entries.get(term);
    if (!entry) return; // draft: no file yet
    for (const target of linkTargets(entry.body)) {
      const j = indexOf.get(target);
      if (j === undefined) {
        fail(
          `${entry.file}: links to "${target}", which is not a term in Curriculum.md`
        );
      }
      if (j === i) fail(`${entry.file}: links to itself`);
      outbound[i]!.add(j);
      inbound[j]!.add(i);
    }
  });

  // Undirected neighbour sets drive both degree and the similarity weight.
  const neighbours: Set<number>[] = terms.map(() => new Set());
  terms.forEach((_, i) => {
    for (const j of outbound[i]!) {
      neighbours[i]!.add(j);
      neighbours[j]!.add(i);
    }
  });

  // Collapse to undirected edges. Direction survives on each node's
  // outbound/inbound lists, which is where the panel reads it from.
  const edges: Edge[] = [];
  const edgeAt = new Map<string, Edge>();
  terms.forEach((_, i) => {
    for (const j of outbound[i]!) {
      const [a, b] = i < j ? [i, j] : [j, i];
      const key = `${a}:${b}`;
      if (!edgeAt.has(key)) {
        const edge: Edge = {
          a,
          b,
          w: cosine(neighbours[a]!, neighbours[b]!),
          t: 0,
          c: 0,
        };
        edgeAt.set(key, edge);
        edges.push(edge);
      }
    }
  });

  markBackbone(terms.length, edges);

  const incident: Edge[][] = terms.map(() => []);
  for (const e of edges) {
    incident[e.a]!.push(e);
    incident[e.b]!.push(e);
  }

  const nodes: GraphNode[] = terms.map((term, i) => {
    const mine = incident[i]!;
    const related = [...mine]
      .sort((x, y) => y.w - x.w || other(x, i) - other(y, i))
      .slice(0, RELATED_N)
      .map((e) => other(e, i));
    return {
      index: i,
      term,
      degree: neighbours[i]!.size,
      related,
      outbound: [...outbound[i]!].sort((x, y) => x - y),
      inbound: [...inbound[i]!].sort((x, y) => x - y),
    };
  });

  // Stable emission order so the JSON diff stays readable across regenerations.
  edges.sort((x, y) => x.a - y.a || x.b - y.b);

  return { nodes, edges };
}

function other(e: Edge, i: number): number {
  return e.a === i ? e.b : e.a;
}

/** |N(a) ∩ N(b)| / sqrt(|N(a)| · |N(b)|) — how alike two terms' neighbourhoods are. */
function cosine(a: Set<number>, b: Set<number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const x of small) if (large.has(x)) shared++;
  return shared / Math.sqrt(a.size * b.size);
}

/**
 * Symmetric kNN: an edge joins the backbone if it is in the top K by weight for
 * either endpoint. Taking the union rather than the intersection is what keeps
 * low-degree nodes attached instead of stranding them.
 */
function markBackbone(nodeCount: number, edges: Edge[]): void {
  const incident: Edge[][] = Array.from({ length: nodeCount }, () => []);
  for (const e of edges) {
    incident[e.a]!.push(e);
    incident[e.b]!.push(e);
  }
  for (let i = 0; i < nodeCount; i++) {
    const mine = [...incident[i]!].sort(
      (x, y) => y.w - x.w || other(x, i) - other(y, i)
    );
    for (const e of mine.slice(0, BACKBONE_K)) e.t = 1;
  }
}

/**
 * How far each edge bows away from the graph centre, as a fraction of its own
 * length. Edges leaving a node in nearly the same direction get different bows,
 * so bundles read as separate strands instead of collapsing into one stroke.
 *
 * A scalar rather than an offset vector: in 3D there is no single sensible
 * "perpendicular", so the shader bends each edge outward along the direction
 * from the centre, which reads consistently from any camera angle.
 *
 * Must run after layout — it needs positions.
 */
export function assignCurvature(
  edges: Edge[],
  pos: { x: number; y: number; z: number }[]
): void {
  const BUCKET = Math.PI / 10;
  const bows = new Map<Edge, number[]>(edges.map((e) => [e, []]));

  const byNode = new Map<number, Edge[]>();
  for (const e of edges) {
    for (const n of [e.a, e.b]) {
      const list = byNode.get(n) ?? [];
      list.push(e);
      byNode.set(n, list);
    }
  }

  for (const [n, incident] of byNode) {
    // Bucket by direction on the two dominant axes; exact angular clustering in
    // 3D is overkill for what is only a visual separation.
    const angleOf = (e: Edge) => {
      const m = other(e, n);
      return Math.atan2(pos[m]!.y - pos[n]!.y, pos[m]!.x - pos[n]!.x);
    };
    const tiltOf = (e: Edge) => {
      const m = other(e, n);
      return Math.atan2(pos[m]!.z - pos[n]!.z, pos[m]!.x - pos[n]!.x);
    };
    const buckets = new Map<string, Edge[]>();
    for (const e of incident) {
      const key = `${Math.round(angleOf(e) / BUCKET)}:${Math.round(tiltOf(e) / BUCKET)}`;
      const list = buckets.get(key) ?? [];
      list.push(e);
      buckets.set(key, list);
    }
    for (const list of buckets.values()) {
      list.sort((x, y) => angleOf(x) - angleOf(y) || other(x, n) - other(y, n));
      const mid = (list.length - 1) / 2;
      list.forEach((e, i) => bows.get(e)!.push((i - mid) * 0.055));
    }
  }

  for (const e of edges) {
    const o = bows.get(e)!;
    const mean = o.length ? o.reduce((s, v) => s + v, 0) / o.length : 0;
    // A base bow even on unbundled edges keeps the graph from looking like a
    // wireframe; the sign is stable because a < b always.
    e.c = round(0.1 + Math.abs(mean) + ((e.a + e.b) % 2 === 0 ? 0.02 : -0.02));
  }
}

function round(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}
