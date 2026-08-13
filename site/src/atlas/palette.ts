// The editorial palette, matching the design tokens in globals.css.
//
// The reference exposes five accents. Eleven sections need eleven colors, so
// the five are rotated through two lightness steps rather than replaced with a
// rainbow — the point is to keep the register, not to maximise hue separation.
// Pure #0f8 green is unreadable on light paper, so it is darkened to a viridian.

export const PAPER: [number, number, number] = [0.918, 0.918, 0.91]; // #eaeae8
export const INK: [number, number, number] = [0.102, 0.102, 0.098]; // #1a1a19

const HEX = [
  "#0070f3", // 1  The Model and Its Tokens
  "#7928ca", // 2  The Machine It Runs On
  "#c1121f", // 3  Making It Fit
  "#0a7d5a", // 4  How a Request Is Served
  "#b5179e", // 5  What You Measure
  "#1d4ed8", // 6  The KV Cache & Batching
  "#9d4edd", // 7  Splitting Across GPUs
  "#e5383b", // 8  Serving Real Traffic
  "#00916e", // 9  Getting the Model Onto the Machine
  "#7b2cbf", // 10 Benchmarking & What It Costs
  "#3a3a37", // 11 Runpod — neutral, it is the concrete-platform section
];

function srgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export const SECTION_RGB: [number, number, number][] = HEX.map(srgb);
export const SECTION_HEX = HEX;

/** Flat Float32Array for a `uniform vec3 uPalette[N]`. */
export function paletteArray(count: number): Float32Array {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const c = SECTION_RGB[i % SECTION_RGB.length]!;
    out[i * 3] = c[0];
    out[i * 3 + 1] = c[1];
    out[i * 3 + 2] = c[2];
  }
  return out;
}
