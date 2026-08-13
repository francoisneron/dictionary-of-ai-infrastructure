// Entry markdown -> structured HTML, at build time.
//
// This happens here rather than in the app for four reasons: the site is a
// static export so there is no server later; the sr-only accessibility fallback
// needs real HTML in the static output anyway; shipping a markdown parser to
// re-render byte-identical content on every page load is waste; and the
// cross-link rewrite needs the term index, which only the generator has.
//
// The entry is split rather than emitted as one blob, because the panel shows
// its parts separately: the overheard exchange sits above the definition, and
// the definition is collapsible.

import { marked } from "marked";
import { linkRe, headingSlug } from "./entries.js";

marked.setOptions({ gfm: true, breaks: false });

export type Heard = { question: string; answer: string };

export type RenderedEntry = {
  /** The body with the Usage dialogue removed, as HTML. */
  definition: string;
  /** The two-line Usage exchange, or null if an entry somehow lacks one. */
  heard: Heard | null;
};

const USAGE_MARKER = /(^|\n)_Usage:_\s*\n/;

/**
 * Splits the Usage dialogue off before rendering rather than unpicking it from
 * HTML afterwards. Every entry ends with the same shape — the label, then a
 * quoted question, then a quoted answer — so the split is on the source, where
 * that shape is still obvious.
 */
function splitUsage(body: string): { definition: string; heard: Heard | null } {
  const match = USAGE_MARKER.exec(body);
  if (!match) return { definition: body, heard: null };

  const definition = body.slice(0, match.index).trimEnd();
  const rest = body.slice(match.index + match[0].length);

  const quoted = rest
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^"(.*)"$/s, "$1"));

  if (quoted.length < 2 || !quoted[0] || !quoted[1]) {
    return { definition, heard: null };
  }
  return { definition, heard: { question: quoted[0], answer: quoted[1] } };
}

/**
 * Cross-links become anchors carrying `data-term`, which is the whole client
 * integration: the panel attaches a single delegated click listener and reads
 * `closest("[data-term]")`, so there is no per-link React element and no
 * hydration cost proportional to link count.
 */
function withAnchors(md: string, knownTerms: Set<string>): string {
  return md.replace(linkRe(), (whole, text: string, target: string) => {
    const term = decodeURIComponent(target);
    if (!knownTerms.has(term)) return whole;
    return `<a href="#${headingSlug(term)}" data-term="${headingSlug(term)}" class="xlink">${text}</a>`;
  });
}

export function renderEntry(
  body: string,
  knownTerms: Set<string>
): RenderedEntry {
  const { definition, heard } = splitUsage(body);
  const html = marked.parse(withAnchors(definition, knownTerms), {
    async: false,
  });
  return { definition: wrapAvoid(html), heard };
}

/** The one italic label that stays inside the definition. */
function wrapAvoid(html: string): string {
  return html.replace(
    /<p><em>Avoid:<\/em>([\s\S]*?)<\/p>/,
    (_m, rest: string) =>
      `<p class="avoid"><span class="avoid-label">Avoid</span>${rest}</p>`
  );
}

/** Full entry HTML including the dialogue — used by the sr-only article. */
export function renderFull(body: string, knownTerms: Set<string>): string {
  const html = marked.parse(withAnchors(body, knownTerms), { async: false });
  return wrapAvoid(html).replace(
    /<p><em>Usage:<\/em><\/p>/,
    `<p class="usage-label">Heard in the wild</p>`
  );
}

/** Plain text, for search indexing and word counts. */
export function toPlainText(body: string): string {
  return body
    .replace(linkRe(), "$1")
    .replace(/[*_`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
