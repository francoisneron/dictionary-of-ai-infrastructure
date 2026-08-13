#!/usr/bin/env -S npx tsx
// Generate the atlas site's data from the same source the README comes from:
// internal/Curriculum.md + dictionary/*.md.
//
// Emits three files, split by when the app needs them:
//   atlas.json    graph — nodes without bodies, edges, sections. Client bundle.
//   entries.json  slug -> rendered HTML. Server-component import only.
//   meta.json     counts and hashes.
//
// Flags:
//   --check     CI mode. A term with no locked position is a hard failure
//               rather than a trigger for an incremental layout.
//   --relayout  Full cold layout from scratch. Deliberate rebalance.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

import { fail, headingSlug, readEntries } from "./lib/entries.js";
import { parseCurriculum, orderedTerms } from "./lib/curriculum.js";
import { buildGraph, assignCurvature } from "./lib/graph.js";
import { computeLayout, type Lock } from "./lib/layout.js";
import { renderEntry } from "./lib/markdown.js";
import { validateEntries, validateGraph, report } from "./lib/validate.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const CURRICULUM = join(HERE, "Curriculum.md");
const DICT_DIR = join(ROOT, "dictionary");
const LOCK_PATH = join(HERE, "layout.lock.json");
const DATA_DIR = join(ROOT, "site", "src", "data");

const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const RELAYOUT = argv.includes("--relayout");

function readLock(): Lock | null {
  if (!existsSync(LOCK_PATH)) return null;
  try {
    const lock = JSON.parse(readFileSync(LOCK_PATH, "utf8")) as Lock;
    if (typeof lock?.version !== "number" || !lock.positions) return null;
    return lock;
  } catch {
    fail(`${LOCK_PATH}: not valid JSON — delete it and run "npm run relayout"`);
  }
}

function main(): void {
  const sections = parseCurriculum(readFileSync(CURRICULUM, "utf8"));
  const terms = orderedTerms(sections);
  const entries = readEntries(DICT_DIR);

  // A curriculum term with no file is a draft: it still gets a node, so the
  // atlas doubles as a progress dashboard while entries are being written.
  const published = new Set(
    [...entries.keys()].filter((t) => terms.includes(t))
  );

  const problems = validateEntries(terms, entries);
  const graph = buildGraph(terms, entries);
  problems.push(...validateGraph(graph, published));
  report(problems);

  const lock = readLock();
  const layout = computeLayout(
    terms,
    sections,
    graph.edges,
    graph.nodes.map((n) => n.degree),
    lock,
    { relayout: RELAYOUT }
  );

  if (CHECK && layout.mode !== "locked") {
    fail(
      `Layout is not locked (${layout.added.length} new term(s): ${layout.added.join(", ")}).\n` +
        `Run "npm run generate" locally and commit internal/layout.lock.json.`
    );
  }

  assignCurvature(graph.edges, layout.positions);

  const sectionOf = new Map<string, number>();
  sections.forEach((s, i) => s.terms.forEach((t) => sectionOf.set(t, i)));

  const nodes = graph.nodes.map((n) => {
    const entry = entries.get(n.term);
    const p = layout.positions[n.index]!;
    return {
      i: n.index,
      id: headingSlug(n.term),
      label: n.term,
      aliases: entry?.aliases ?? [],
      section: sectionOf.get(n.term) ?? 0,
      description: entry?.description ?? "",
      x: p.x,
      y: p.y,
      z: p.z,
      degree: n.degree,
      related: n.related,
      outbound: n.outbound,
      inbound: n.inbound,
      status: entry ? "published" : "draft",
    };
  });

  const atlas = {
    sections: sections.map((s, i) => ({ index: i, title: s.title })),
    nodes,
    edges: graph.edges.map((e) => ({
      a: e.a,
      b: e.b,
      w: Math.round(e.w * 1e3) / 1e3,
      t: e.t,
      c: e.c,
    })),
  };

  const knownTerms = new Set(terms);
  // The panel shows the parts separately — the overheard exchange above the
  // definition, the definition collapsible — so they are emitted separately
  // rather than as one blob the client would have to pick apart.
  const entriesOut: Record<
    string,
    {
      label: string;
      definition: string;
      heard: { question: string; answer: string } | null;
    }
  > = {};
  for (const term of terms) {
    const entry = entries.get(term);
    if (!entry) continue;
    const { definition, heard } = renderEntry(entry.body.trimEnd(), knownTerms);
    entriesOut[headingSlug(term)] = { label: term, definition, heard };
  }

  const contentHash = createHash("sha256");
  contentHash.update(readFileSync(CURRICULUM));
  for (const term of terms) {
    const entry = entries.get(term);
    if (entry) contentHash.update(entry.raw);
  }

  const meta = {
    version: 1,
    terms: terms.length,
    published: published.size,
    drafts: terms.length - published.size,
    sections: sections.length,
    edges: graph.edges.length,
    backboneEdges: graph.edges.filter((e) => e.t === 1).length,
    seed: layout.lock.seed,
    contentHash: contentHash.digest("hex").slice(0, 16),
  };

  mkdirSync(DATA_DIR, { recursive: true });
  // Minified: these are generated, prettier-ignored, and shipped to the client.
  writeFileSync(join(DATA_DIR, "atlas.json"), JSON.stringify(atlas));
  writeFileSync(join(DATA_DIR, "entries.json"), JSON.stringify(entriesOut));
  writeFileSync(
    join(DATA_DIR, "meta.json"),
    JSON.stringify(meta, null, 2) + "\n"
  );

  // Pretty-printed on purpose — you want to read this diff.
  if (layout.mode !== "locked" || !existsSync(LOCK_PATH)) {
    writeFileSync(LOCK_PATH, JSON.stringify(layout.lock, null, 2) + "\n");
  }

  const intra = graph.edges.filter(
    (e) => e.t === 1 && nodes[e.a]!.section === nodes[e.b]!.section
  ).length;
  const backbone = meta.backboneEdges;
  console.log(
    `site data: ${meta.terms} terms (${meta.drafts} draft), ${meta.edges} edges ` +
      `(${backbone} backbone, ${backbone ? Math.round((intra / backbone) * 100) : 0}% intra-section), ` +
      `layout ${layout.mode}${layout.added.length ? ` (+${layout.added.length})` : ""}`
  );
}

main();
