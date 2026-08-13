// Content invariants, in one place. The generator is the only test harness this
// repo has, so anything that would silently produce a broken README or a broken
// atlas should fail loudly here with a file:line.

import type { Entry } from "./entries.js";
import type { Graph } from "./graph.js";

const MAX_DESCRIPTION = 140;
const MIN_WORDS = 200;

// Windows forbids these in filenames, and the term IS the filename. Catching it
// here beats someone discovering it at `git clone` time on another machine.
const ILLEGAL_NAME = /[<>:"/\\|?*]/;

// Real tags, not the "<" in "p99 < 200ms". Entry HTML is injected with
// dangerouslySetInnerHTML, so the trusted-content invariant is checked, not assumed.
const HTML_TAG = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^>]*)?>|<!--/;

export type Problem = { level: "error" | "warn"; message: string };

export function validateEntries(
  terms: string[],
  entries: Map<string, Entry>
): Problem[] {
  const problems: Problem[] = [];
  const aliasOwner = new Map<string, string>();
  const termSet = new Set(terms);

  for (const term of terms) {
    if (ILLEGAL_NAME.test(term)) {
      problems.push({
        level: "error",
        message: `Curriculum.md: term "${term}" contains a character that cannot appear in a filename (< > : " / \\ | ? *)`,
      });
    }
  }

  for (const entry of entries.values()) {
    const { file, description, body, aliases, bodyLine } = entry;

    if (description.length >= MAX_DESCRIPTION) {
      problems.push({
        level: "error",
        message: `${file}:2: description is ${description.length} characters, must be under ${MAX_DESCRIPTION}`,
      });
    }

    if (!/\n_Usage:_\n/.test(`\n${body}`)) {
      problems.push({
        level: "error",
        message: `${file}:${bodyLine}: missing the "_Usage:_" block — every entry ends with one`,
      });
    }

    const withoutCode = body.replace(/`[^`]*`/g, "");
    if (HTML_TAG.test(withoutCode)) {
      problems.push({
        level: "error",
        message: `${file}:${bodyLine}: raw HTML is not allowed in entry bodies`,
      });
    }

    if (/^#{1,6} /m.test(body)) {
      problems.push({
        level: "error",
        message: `${file}:${bodyLine}: entries have no headings — the filename is the title`,
      });
    }

    if (/^```/m.test(body)) {
      problems.push({
        level: "error",
        message: `${file}:${bodyLine}: entries have no code fences`,
      });
    }

    for (const alias of aliases) {
      if (termSet.has(alias)) {
        problems.push({
          level: "error",
          message: `${file}: alias "${alias}" collides with an existing term`,
        });
      }
      const owner = aliasOwner.get(alias.toLowerCase());
      if (owner) {
        problems.push({
          level: "error",
          message: `${file}: alias "${alias}" is already used by "${owner}"`,
        });
      }
      aliasOwner.set(alias.toLowerCase(), entry.term);
    }

    const words = body.trim().split(/\s+/).filter(Boolean).length;
    if (words < MIN_WORDS) {
      problems.push({
        level: "warn",
        message: `${file}: ${words} words, below the ${MIN_WORDS}-word minimum`,
      });
    }
  }

  return problems;
}

export function validateGraph(graph: Graph, published: Set<string>): Problem[] {
  const problems: Problem[] = [];
  for (const node of graph.nodes) {
    if (!published.has(node.term)) continue; // drafts have no links yet
    if (node.degree === 0) {
      problems.push({
        level: "warn",
        message: `dictionary/${node.term}.md: no cross-links in or out — it will render as an isolated node`,
      });
    }
  }
  return problems;
}

export function report(problems: Problem[]): void {
  const errors = problems.filter((p) => p.level === "error");
  const warnings = problems.filter((p) => p.level === "warn");

  for (const w of warnings) console.warn(`warning: ${w.message}`);
  for (const e of errors) console.error(`error: ${e.message}`);

  if (errors.length) {
    console.error(
      `\n${errors.length} error${errors.length === 1 ? "" : "s"}. Nothing written.`
    );
    process.exit(1);
  }
}
