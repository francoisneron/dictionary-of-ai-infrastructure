"use client";

import { useEffect, useRef, useState } from "react";

type Props = { ready: boolean };

const WORDS = ["The AI", "Infrastructure", "Dictionary"];

/**
 * The title card shown while the atlas initializes.
 *
 * Progress is tied to real readiness — fonts resolved and the GL context built
 * — rather than to a timer, so the bar means something. It still eases toward
 * the end so a fast machine doesn't get a single jarring jump.
 */
export default function LoadingScreen({ ready }: Props) {
  const [progress, setProgress] = useState(0);
  const [gone, setGone] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    let fontsDone = false;
    document.fonts?.ready.then(() => {
      fontsDone = true;
    });

    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      // Approach the target asymptotically; snap to 100 only once genuinely ready.
      const target = (ready ? 0.75 : 0.4) + (fontsDone ? 0.2 : 0);
      const eased = Math.min(target, 1 - Math.exp(-elapsed / 260));
      setProgress(ready && fontsDone ? 1 : eased);
      if (!(ready && fontsDone)) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [ready]);

  useEffect(() => {
    if (progress < 1) return;
    const reduced =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setGone(true), reduced ? 0 : 420);
    return () => clearTimeout(t);
  }, [progress]);

  if (gone) return null;

  return (
    <div
      className={`loading-screen${progress >= 1 ? " is-done" : ""}`}
      aria-hidden="true"
    >
      <p className="loading-credit">A map of</p>
      <h1 className="loading-title">
        {WORDS.map((word, i) => (
          <span
            key={word}
            className="loading-word"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {word}
          </span>
        ))}
      </h1>
      <div className="loading-bar">
        <span
          className="loading-fill"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </div>
  );
}
