// The editorial palette, matching the design tokens in globals.css.

export const PAPER: [number, number, number] = [0.918, 0.918, 0.91]; // #eaeae8
export const INK: [number, number, number] = [0.102, 0.102, 0.098]; // #1a1a19

function srgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// --- page washes ----------------------------------------------------------

/*
 * A section's colour belongs to the page, not to eleven dots.
 *
 * Tinting the nodes was the first attempt and it did not work: at the scale of
 * a disc a hue reads as a slightly different grey, and eighty-four of them
 * compete rather than group. So a section's colour is now the colour of the
 * whole page while you are inside it — background, panel, labels and chrome
 * together.
 *
 * They alternate dark, light, dark, light down the list. Neighbouring sections
 * are the ones a reader crosses between, and two washes of the same weight in
 * a row read as the same colour even when the hue differs.
 */
const WASH_HEX = [
  "#0d2f61", // 1  The Model and Its Tokens — navy
  "#ded6f4", // 2  The Machine It Runs On — pale lilac
  "#611015", // 3  Making It Fit — oxblood
  "#c2e0d3", // 4  How a Request Is Served — pale mint
  "#4d1042", // 5  What You Measure — plum
  "#d3ddf7", // 6  The KV Cache & Batching — pale periwinkle
  "#371c5e", // 7  Splitting Across GPUs — violet
  "#f8dad6", // 8  Serving Real Traffic — pale coral
  "#12564a", // 9  Getting the Model Onto the Machine — deep teal
  "#ece4d6", // 10 Benchmarking & What It Costs — parchment
  "#1e1e1c", // 11 Runpod — near-black, the neutral platform section
];

export type PageTheme = {
  /** Canvas clear colour and halo colour. */
  paper: [number, number, number];
  /** Canvas node and edge colour. */
  ink: [number, number, number];
  /** Custom properties to set on the root element. Empty for the default. */
  vars: Record<string, string>;
};

function hexOf(c: [number, number, number]): string {
  const b = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${b(c[0])}${b(c[1])}${b(c[2])}`;
}

function mix(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** Relative luminance, sRGB linearised — WCAG's definition. */
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function rgba(c: [number, number, number], alpha: number): string {
  const b = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `rgba(${b(c[0])}, ${b(c[1])}, ${b(c[2])}, ${alpha})`;
}

/**
 * Every custom property a wash overrides — and so exactly the set to clear
 * when it is removed. Keeping the list here means the two operations cannot
 * drift apart and leave a stale colour pinned to the root element.
 */
export const PAGE_THEME_VARS = [
  "--color-paper",
  "--color-paper-rgb",
  "--color-ink",
  "--surface",
  "--surface-2",
  "--section-paper",
  "--line",
  "--line-strong",
] as const;

/** The untinted theme: whatever the stylesheet already says. */
export const DEFAULT_PAGE_THEME: PageTheme = {
  paper: PAPER,
  ink: INK,
  vars: {},
};

/**
 * The page dressed in one section's colour.
 *
 * Ink is chosen by measuring the wash rather than paired with it by hand, so a
 * wash can be re-picked without anyone having to remember to flip the text.
 * Surfaces are mixed towards the ink rather than towards white: on a dark wash
 * that lifts a panel off the page and on a light one it settles it into the
 * page, and either way the separation is visible at both ends of the range.
 */
export function sectionPageTheme(section: number): PageTheme {
  const paper = srgb(WASH_HEX[section % WASH_HEX.length]!);
  const ink = luminance(paper) > 0.34 ? INK : PAPER;
  const paperHex = hexOf(paper);
  const inkHex = hexOf(ink);

  return {
    paper,
    ink,
    vars: {
      "--color-paper": paperHex,
      "--color-paper-rgb": paper.map((v) => Math.round(v * 255)).join(", "),
      "--color-ink": inkHex,
      "--surface": hexOf(mix(paper, ink, 0.07)),
      "--surface-2": hexOf(mix(paper, ink, 0.14)),
      "--section-paper": hexOf(mix(paper, ink, 0.04)),
      "--line": rgba(ink, 0.16),
      "--line-strong": rgba(ink, 0.3),
    },
  };
}
