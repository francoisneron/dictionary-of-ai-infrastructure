"use client";

import { useEffect, useRef } from "react";
import { AtlasController } from "@/atlas/AtlasController";
import type { Atlas } from "@/atlas/types";
import atlasData from "@/data/atlas.json";

const atlas = atlasData as unknown as Atlas;

type Props = {
  onReady?: (controller: AtlasController) => void;
  onSelect?: (index: number | null) => void;
  onUnsupported?: () => void;
};

/**
 * Mounts once and never re-renders. Everything that changes at frame rate lives
 * inside the controller, not in React state.
 */
export default function AtlasCanvas({
  onReady,
  onSelect,
  onUnsupported,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Held in refs so a changing callback identity can't tear down the GL context.
  const readyRef = useRef(onReady);
  const selectRef = useRef(onSelect);
  const unsupportedRef = useRef(onUnsupported);
  readyRef.current = onReady;
  selectRef.current = onSelect;
  unsupportedRef.current = onUnsupported;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let controller: AtlasController;
    try {
      controller = new AtlasController(canvas, atlas, {
        onSelect: (i) => selectRef.current?.(i),
      });
    } catch (err) {
      console.warn("Atlas unavailable:", err);
      unsupportedRef.current?.();
      return;
    }

    readyRef.current?.(controller);

    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __atlas?: AtlasController }).__atlas = controller;
    }

    return () => {
      controller.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="atlas-canvas"
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        // dvh, not vh — mobile URL bars collapse and vh doesn't notice.
        height: "100dvh",
        display: "block",
        touchAction: "none",
        cursor: "grab",
      }}
    />
  );
}
