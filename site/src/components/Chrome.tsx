"use client";

import { useCallback, useEffect, useRef } from "react";
import { play, setMuted } from "@/audio/sounds";
import meta from "@/data/meta.json";

/** Mono ↔ section colour. On, the whole page is dressed in the colour of the
 *  section you are reading; off, it is paper and ink. */
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

/** The arrow that marks a link as leaving the site. */
function ExternalMark() {
  return (
    <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true">
      <path
        d="M4 2h6v6M10 2L2.6 9.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

  // Closing always hands focus back to the button that opened the dialog —
  // otherwise focus falls to the top of the document and a keyboard reader
  // starts the page again from nothing.
  const dismiss = useCallback(() => {
    play("close");
    onClose();
    triggerRef.current?.focus();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
        return;
      }
      // A dialog over a scrim has to hold focus: without this, tabbing walks
      // out of it onto the map controls the scrim is covering.
      if (e.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])"
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

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
        // The scrim is the click target for dismissing, so the dialog stops
        // the event rather than the scrim testing what was clicked.
        <div className="info-backdrop" onClick={dismiss}>
          <div
            ref={dialogRef}
            className="info-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="info-modal-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="info-modal-close"
              aria-label="Close"
              onClick={dismiss}
            >
              <svg
                viewBox="0 0 16 16"
                width="13"
                height="13"
                aria-hidden="true"
              >
                <path
                  d="M4.5 4.5l7 7M11.5 4.5l-7 7"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <p className="info-eyebrow">About</p>
            <h2 id="info-modal-title">The AI Infrastructure Dictionary</h2>
            <p>
              The vocabulary of AI infrastructure in plain English. {meta.terms}{" "}
              terms across {meta.sections} sections, arranged as a map.
            </p>
            <p>
              Every line is a cross-reference written inside an entry, so the
              map is the writing rather than a diagram of it. Click a node to
              open a term and follow the threads out of it.
            </p>

            <p className="info-links">
              <a
                href="https://github.com/francoisneron/dictionary-of-ai-infrastructure"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
                <ExternalMark />
              </a>
            </p>

            <hr className="info-rule" />

            <p className="info-eyebrow">Credits</p>
            <a
              className="info-person"
              href="https://www.linkedin.com/in/francoisneron00/"
              target="_blank"
              rel="noreferrer"
            >
              {/* Plain img: next/image buys nothing here — the file is 5KB, a
                  fixed size, and images are unoptimized for the static export. */}
              <img src="/francois-neron.jpg" alt="" width={34} height={34} />
              <span className="info-person-text">
                <strong>François Néron</strong>
                <span>Author · LinkedIn</span>
              </span>
            </a>

            <p className="info-eyebrow info-eyebrow-spaced">Inspired by</p>
            <p className="info-people">
              <a
                className="info-person info-person-sm"
                href="https://x.com/mattpocockuk"
                target="_blank"
                rel="noreferrer"
              >
                <img src="/matt-pocock.png" alt="" width={24} height={24} />
                <span>Matt Pocock</span>
                <ExternalMark />
              </a>
              <a
                className="info-person info-person-sm"
                href="https://x.com/vojta_holik"
                target="_blank"
                rel="noreferrer"
              >
                <img src="/vojta-holik.jpg" alt="" width={24} height={24} />
                <span>Vojta Holik</span>
                <ExternalMark />
              </a>
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
          </div>
        </div>
      )}
    </>
  );
}
