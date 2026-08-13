// Parsing internal/Curriculum.md. The grammar is deliberately strict — only
// "## Section N — Title" headings and "- Term" bullets — so that a malformed
// curriculum fails the build rather than silently dropping an entry.

import { fail } from "./entries.js";

const SECTION_RE = /^## Section \d+ — .+$/;
const BULLET_RE = /^- (.+)$/;

export type Section = { heading: string; title: string; terms: string[] };

export function parseCurriculum(text: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;

  text.split("\n").forEach((raw, idx) => {
    const lineNo = idx + 1;
    const line = raw.trimEnd();
    if (line === "") return;

    if (line.startsWith("## ")) {
      if (!SECTION_RE.test(line)) {
        fail(
          `Curriculum.md:${lineNo}: section heading must match "## Section N — Title" (em-dash required): ${line}`
        );
      }
      const heading = line.slice(3);
      const title = heading.slice(heading.indexOf("—") + 1).trim();
      current = { heading, title, terms: [] };
      sections.push(current);
      return;
    }

    if (line.startsWith("- ")) {
      if (!current)
        fail(`Curriculum.md:${lineNo}: bullet before any section heading`);
      const m = line.match(BULLET_RE);
      if (!m || !m[1])
        fail(`Curriculum.md:${lineNo}: malformed bullet: ${line}`);
      const term = m[1];
      if (term.trim() !== term)
        fail(`Curriculum.md:${lineNo}: term has surrounding whitespace`);
      if (/[*_`[]/.test(term))
        fail(
          `Curriculum.md:${lineNo}: term must be plain text, no markdown: ${term}`
        );
      current.terms.push(term);
      return;
    }

    fail(
      `Curriculum.md:${lineNo}: only "## Section N — Title" headings and "- Term" bullets are allowed: ${line}`
    );
  });

  return sections;
}

/** Curriculum order, flattened. Fails on a duplicate term. */
export function orderedTerms(sections: Section[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const section of sections) {
    for (const term of section.terms) {
      if (seen.has(term)) fail(`Curriculum.md: duplicate term "${term}"`);
      seen.add(term);
      out.push(term);
    }
  }
  return out;
}
