// Search scoring. Hand-rolled rather than a dependency: 84 items across three
// fields is a synchronous scan measured in tens of microseconds, and a fuzzy
// search library would ship ~12 KB to do it worse.

import type { AtlasNode } from "@/atlas/types";

export type Hit = {
  index: number;
  score: number;
  /** Character range matched in the label, for bolding the hit. */
  range: [number, number] | null;
};

function norm(s: string): string {
  return s.toLowerCase().normalize("NFKD");
}

/**
 * Subsequence match: "kvc" matches "KV cache". Penalised by how spread out the
 * matched characters are, so tight matches outrank scattered ones.
 */
function subsequenceScore(hay: string, needle: string): number | null {
  let hi = 0;
  let gaps = 0;
  let last = -1;
  for (const ch of needle) {
    const found = hay.indexOf(ch, hi);
    if (found === -1) return null;
    if (last >= 0) gaps += found - last - 1;
    last = found;
    hi = found + 1;
  }
  return Math.max(20, 150 - gaps * 6);
}

export function searchNodes(nodes: AtlasNode[], query: string): Hit[] {
  const q = norm(query.trim());
  if (!q) return [];

  const hits: Hit[] = [];

  for (const node of nodes) {
    const label = norm(node.label);
    let score = 0;
    let range: [number, number] | null = null;

    if (label === q) {
      score = 1000;
      range = [0, node.label.length];
    } else if (label.startsWith(q)) {
      score = 500;
      range = [0, q.length];
    } else {
      // Word-boundary prefix: "cache" should find "KV cache".
      const wordIdx = label.indexOf(` ${q}`);
      if (wordIdx >= 0) {
        score = 400;
        range = [wordIdx + 1, wordIdx + 1 + q.length];
      }
    }

    if (!score) {
      for (const alias of node.aliases) {
        const a = norm(alias);
        if (a === q) {
          score = Math.max(score, 300);
        } else if (a.startsWith(q)) {
          score = Math.max(score, 250);
        }
      }
    }

    if (!score) {
      const idx = label.indexOf(q);
      if (idx >= 0) {
        score = 200;
        range = [idx, idx + q.length];
      }
    }

    if (!score) {
      const sub = subsequenceScore(label, q);
      if (sub !== null) score = sub;
    }

    if (!score && norm(node.description).includes(q)) {
      score = 50;
    }

    if (score > 0) hits.push({ index: node.i, score, range });
  }

  // Ties break on degree: hubs surface first, which is almost always what you
  // want when the query is ambiguous.
  hits.sort(
    (a, b) =>
      b.score - a.score ||
      (nodes[b.index]?.degree ?? 0) - (nodes[a.index]?.degree ?? 0)
  );

  return hits.slice(0, 8);
}
