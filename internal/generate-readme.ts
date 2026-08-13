#!/usr/bin/env -S npx tsx
// Generate README.md from internal/Curriculum.md + dictionary/*.md + internal/README.template.md.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fail, headingSlug, stripFrontmatter, linkRe } from "./lib/entries.js";
import { parseCurriculum } from "./lib/curriculum.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const CURRICULUM = join(HERE, "Curriculum.md");
const TEMPLATE = join(HERE, "README.template.md");
const DICT_DIR = join(ROOT, "dictionary");
const OUTPUT = join(ROOT, "README.md");
const MARKER = "<!-- CURRICULUM -->";
const TOC_MARKER = "<!-- TOC -->";

/** Cross-entry links become in-page anchors, since every entry is inlined here. */
function rewriteLinks(body: string): string {
  return body.replace(linkRe(), (_, text: string, target: string) => {
    return `[${text}](#${headingSlug(decodeURIComponent(target))})`;
  });
}

function main(): void {
  const template = readFileSync(TEMPLATE, "utf8");
  if (!template.includes(MARKER)) fail(`Template missing ${MARKER} marker`);
  if (!template.includes(TOC_MARKER))
    fail(`Template missing ${TOC_MARKER} marker`);

  const sections = parseCurriculum(readFileSync(CURRICULUM, "utf8"));

  const seen = new Set<string>();
  const written = new Set<string>();
  const drafts: string[] = [];
  const parts: string[] = [];
  for (const section of sections) {
    const present = section.terms.filter((t) =>
      existsSync(join(DICT_DIR, `${t}.md`))
    );
    // A section with nothing written yet is omitted rather than left as an
    // empty heading — the README should read as finished work, not as a plan.
    if (present.length) parts.push(`## ${section.heading}`, "");
    for (const term of section.terms) {
      if (seen.has(term)) fail(`Curriculum.md: duplicate term "${term}"`);
      seen.add(term);
      const entryPath = join(DICT_DIR, `${term}.md`);
      // Curriculum terms with no file yet are drafts: the atlas renders them as
      // placeholders so entries can link forward, and the README skips them.
      if (!existsSync(entryPath)) {
        drafts.push(term);
        continue;
      }
      written.add(term);
      const body = readFileSync(entryPath, "utf8");
      parts.push(
        `### ${term}`,
        "",
        rewriteLinks(stripFrontmatter(body).trimEnd()),
        ""
      );
    }
  }

  const onDisk = new Set(
    readdirSync(DICT_DIR)
      .filter((n) => n.endsWith(".md"))
      .map((n) => n.slice(0, -3))
  );
  const orphans = [...onDisk].filter((t) => !seen.has(t)).sort();
  if (orphans.length)
    fail(
      `dictionary/ entries not referenced by Curriculum.md: ${orphans.join(", ")}`
    );

  const block = parts.join("\n").trimEnd() + "\n";
  const toc = sections
    .filter((s) => s.terms.some((t) => written.has(t)))
    .map((s) => {
      const terms = s.terms
        .filter((t) => written.has(t))
        .map((t) => `- [${t}](#${headingSlug(t)})`)
        .join("\n");
      return [
        "<details>",
        `<summary>${s.heading}</summary>`,
        "",
        terms,
        "",
        "</details>",
      ].join("\n");
    })
    .join("\n\n");
  const banner =
    "<!--\n" +
    "  GENERATED FILE — DO NOT EDIT.\n" +
    "  Source: dictionary/*.md, internal/Curriculum.md, internal/README.template.md\n" +
    "  Regenerate: npm run generate\n" +
    "-->\n\n";
  writeFileSync(
    OUTPUT,
    banner + template.replace(TOC_MARKER, toc).replace(MARKER, block)
  );

  console.log(
    `README.md: ${written.size} of ${seen.size} terms across ${sections.length} sections` +
      (drafts.length ? ` (${drafts.length} not written yet)` : "")
  );
}

main();
