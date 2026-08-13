// Reading and parsing dictionary/*.md. Shared by generate-readme.ts and
// generate-site.ts — the link regex in particular must never be forked, or the
// README's anchors and the atlas's edges can silently disagree.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Matches a cross-link to another entry: [inflected text](./Target%20Term.md)
const LINK_SOURCE = "\\[([^\\]]+)\\]\\(\\.\\/([^)]+)\\.md\\)";

/** A fresh global regex. Never share one instance — `lastIndex` is stateful. */
export function linkRe(): RegExp {
  return new RegExp(LINK_SOURCE, "g");
}

export type Entry = {
  /** Filename stem. Also the README heading and the curriculum bullet. */
  term: string;
  /** Absolute path, used in error messages. */
  file: string;
  /** Full file contents, frontmatter included. */
  raw: string;
  /** Body with frontmatter stripped and leading blank lines removed. */
  body: string;
  description: string;
  aliases: string[];
  /** Line number the body starts on, for `file:line` error messages. */
  bodyLine: number;
};

export function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

/**
 * Mirrors GitHub's heading slugger: lowercase, strip punctuation (keeping
 * hyphens), then replace spaces with hyphens.
 * "Section 1 — The Model" → "section-1--the-model".
 */
export function headingSlug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, "")
    .replace(/ /g, "-");
}

export function stripFrontmatter(body: string): string {
  if (!body.startsWith("---\n")) return body;
  const end = body.indexOf("\n---\n", 4);
  if (end === -1) return body;
  return body.slice(end + 5).replace(/^\n+/, "");
}

/**
 * Minimal YAML for the two keys entries actually use: a single-line
 * `description` (plain or double-quoted) and an optional `aliases` block
 * sequence. Anything else is an error rather than a silent no-op — a typo'd key
 * would otherwise vanish without trace.
 */
function parseFrontmatter(
  raw: string,
  file: string
): { description: string; aliases: string[]; bodyLine: number } {
  if (!raw.startsWith("---\n")) {
    fail(`${file}:1: missing frontmatter — every entry needs a description`);
  }
  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) fail(`${file}:1: frontmatter is not terminated by "---"`);

  const lines = raw.slice(4, end).split("\n");
  let description: string | null = null;
  const aliases: string[] = [];
  let inAliases = false;

  lines.forEach((line, idx) => {
    const lineNo = idx + 2; // 1-based, and line 1 is the opening "---"
    if (line.trim() === "") return;

    if (line.startsWith("  - ")) {
      if (!inAliases) fail(`${file}:${lineNo}: list item outside "aliases:"`);
      const alias = line.slice(4).trim();
      if (!alias) fail(`${file}:${lineNo}: empty alias`);
      aliases.push(alias);
      return;
    }

    inAliases = false;

    if (line.startsWith("description:")) {
      if (description !== null)
        fail(`${file}:${lineNo}: duplicate "description" key`);
      const value = line.slice("description:".length).trim();
      if (value.startsWith('"') && value.endsWith('"') && value.length > 1) {
        description = value.slice(1, -1).replace(/\\"/g, '"');
      } else {
        description = value;
      }
      return;
    }

    if (line === "aliases:") {
      inAliases = true;
      return;
    }

    fail(
      `${file}:${lineNo}: unsupported frontmatter key — only "description" and "aliases" are allowed: ${line}`
    );
  });

  if (description === null || description === "") {
    fail(`${file}:2: frontmatter is missing a "description" value`);
  }

  // +1 for the opening "---", +1 for the closing "---", +1 to land on the line after
  const bodyLine = lines.length + 3;
  return { description, aliases, bodyLine };
}

export function readEntries(dictDir: string): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  const names = readdirSync(dictDir)
    .filter((n) => n.endsWith(".md"))
    .sort();

  for (const name of names) {
    const term = name.slice(0, -3);
    const file = join(dictDir, name);
    const raw = readFileSync(file, "utf8");
    const { description, aliases, bodyLine } = parseFrontmatter(raw, file);
    entries.set(term, {
      term,
      file,
      raw,
      body: stripFrontmatter(raw),
      description,
      aliases,
      bodyLine,
    });
  }

  return entries;
}

/** Every cross-link target in a body, decoded to a bare term name. */
export function linkTargets(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(linkRe())) {
    if (m[2]) out.push(decodeURIComponent(m[2]));
  }
  return out;
}
