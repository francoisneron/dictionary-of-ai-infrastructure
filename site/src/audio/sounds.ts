// Interface sounds, synthesized with Web Audio rather than shipped as files.
//
// No asset pipeline, no decode latency, no cache misses, per-event variation
// for free, and about 3 KB of code instead of a folder of .wav files in what is
// otherwise a markdown repository.
//
// The register is deliberately paper-like: bandpass-swept noise reads as a
// sheet sliding rather than as a UI beep, which suits the editorial palette
// better than the synth blips these interfaces usually ship with.

type SoundName = "select" | "open" | "close" | "search" | "fly";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = true;

/**
 * The context is constructed on the first real user gesture, never at module
 * load. An AudioContext created early sits suspended and silently swallows the
 * first few sounds, which looks like the audio being broken.
 */
function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;

  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);

  // iOS wants a buffer to have played inside the gesture before it considers
  // the context unlocked.
  const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(master);
  src.start(0);

  return ctx;
}

/** Call from a real user gesture — pointerdown or keydown. */
export function unlockAudio(): void {
  const c = ensureContext();
  if (c && c.state === "suspended") void c.resume();
}

export function setMuted(next: boolean): void {
  muted = next;
  if (!master || !ctx) return;
  // Ramp rather than disconnect: cutting a node mid-envelope clicks audibly.
  master.gain.setTargetAtTime(next ? 0 : 1, ctx.currentTime, 0.02);
}

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(c.sampleRate * seconds));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function tone(
  c: AudioContext,
  out: GainNode,
  from: number,
  to: number,
  gain: number,
  dur: number
): void {
  const osc = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime;
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, t);
  if (to !== from)
    osc.frequency.exponentialRampToValueAtTime(to, t + dur * 0.6);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function sweep(
  c: AudioContext,
  out: GainNode,
  from: number,
  to: number,
  gain: number,
  dur: number
): void {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, dur);
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.8;
  const g = c.createGain();
  const t = c.currentTime;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

export function play(name: SoundName): void {
  if (muted) return;
  const c = ensureContext();
  if (!c || !master || c.state !== "running") return;

  switch (name) {
    case "select":
      tone(c, master, 660, 880, 0.06, 0.14);
      sweep(c, master, 1800, 700, 0.03, 0.05);
      break;
    case "open":
      sweep(c, master, 400, 2000, 0.05, 0.18);
      break;
    case "close":
      sweep(c, master, 2000, 400, 0.045, 0.12);
      break;
    case "search":
      tone(c, master, 1200, 1200, 0.02, 0.025);
      break;
    case "fly":
      sweep(c, master, 300, 1400, 0.03, 0.4);
      break;
  }
}
