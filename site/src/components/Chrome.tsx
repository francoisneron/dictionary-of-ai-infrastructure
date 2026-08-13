"use client";

import { useEffect, useRef } from "react";
import { play, setMuted } from "@/audio/sounds";
import meta from "@/data/meta.json";

/** Mono ↔ section colour. Cheap to build, and it is what makes the eleven
 *  section territories legible at a glance. */
export function ColorToggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`chrome-button${on ? " is-on" : ""}`}
      aria-pressed={on}
      aria-label={on ? "Switch to monochrome" : "Switch to section colours"}
      onClick={() => {
        play("select");
        onToggle();
      }}
    >
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <circle
          cx="8"
          cy="8"
          r="6.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <circle cx="8" cy="5.2" r="1.5" fill="currentColor" />
        <circle cx="5.4" cy="9.4" r="1.5" fill="currentColor" opacity="0.6" />
        <circle cx="10.6" cy="9.4" r="1.5" fill="currentColor" opacity="0.35" />
      </svg>
    </button>
  );
}

export function SoundToggle({
  muted,
  onToggle,
}: {
  muted: boolean;
  onToggle: () => void;
}) {
  // Persisted preference is read in an effect, never during render: reading
  // localStorage while rendering is a guaranteed hydration mismatch.
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    if (localStorage.getItem("atlas:sound") === "on") onToggle();
  }, [onToggle]);

  useEffect(() => {
    setMuted(muted);
  }, [muted]);

  return (
    <button
      type="button"
      className={`chrome-button${muted ? "" : " is-on"}`}
      aria-pressed={!muted}
      aria-label={muted ? "Unmute interface sounds" : "Mute interface sounds"}
      onClick={() => {
        const next = !muted;
        localStorage.setItem("atlas:sound", next ? "off" : "on");
        onToggle();
        if (!next) play("select");
      }}
    >
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <path d="M3 6h2.2L8 3.4v9.2L5.2 10H3z" fill="currentColor" />
        {muted ? (
          <path
            d="M10.5 6l3 4M13.5 6l-3 4"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        ) : (
          <>
            <path
              d="M10.4 6.2a2.6 2.6 0 0 1 0 3.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
            <path
              d="M12.2 4.6a5 5 0 0 1 0 6.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </button>
  );
}

export function InfoModal({
  open,
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
      triggerRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="chrome-button chrome-info"
        aria-label="About this project"
        aria-expanded={open}
        onClick={() => {
          play(open ? "close" : "open");
          open ? onClose() : onOpen();
        }}
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <circle
            cx="8"
            cy="8"
            r="6.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <circle cx="8" cy="4.8" r="0.85" fill="currentColor" />
          <path
            d="M8 7.1v4.4"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div
          ref={dialogRef}
          className="info-modal"
          role="dialog"
          aria-modal="true"
          aria-label="About this project"
          tabIndex={-1}
        >
          <h2>The AI Infrastructure Dictionary</h2>
          <p>
            The vocabulary of AI infrastructure in plain English. {meta.terms}{" "}
            terms across {meta.sections} sections, arranged as a map.
          </p>
          <p>
            Every line is a cross-reference written inside an entry, so the map
            is the writing rather than a diagram of it. {meta.edges} links in
            total, drawn only for the term you point at — hover or select one to
            see the neighbourhood it belongs to.
          </p>
          <p className="info-modal-keys">
            <span>
              <kbd>⌘K</kbd> search
            </span>
            <span>
              <kbd>drag</kbd> pan
            </span>
            <span>
              <kbd>scroll</kbd> zoom
            </span>
            <span>
              <kbd>esc</kbd> close
            </span>
          </p>
          <button type="button" className="info-modal-close" onClick={onClose}>
            Close
          </button>
        </div>
      )}
    </>
  );
}
