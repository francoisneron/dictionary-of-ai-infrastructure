"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Atlas } from "@/atlas/types";
import atlasData from "@/data/atlas.json";
import { searchNodes, type Hit } from "@/search/score";
import { play } from "@/audio/sounds";

const atlas = atlasData as unknown as Atlas;

type Props = { onPick: (index: number) => void };

/** Bolds the matched range without dangerouslySetInnerHTML. */
function Label({
  text,
  range,
}: {
  text: string;
  range: [number, number] | null;
}) {
  if (!range) return <>{text}</>;
  return (
    <>
      {text.slice(0, range[0])}
      <mark>{text.slice(range[0], range[1])}</mark>
      {text.slice(range[1])}
    </>
  );
}

export default function AtlasSearch({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [isMac, setIsMac] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Platform detection in an effect, never during render — under static export
  // it would be a guaranteed hydration mismatch.
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  const hits: Hit[] = query ? searchNodes(atlas.nodes, query) : [];

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
    triggerRef.current?.focus();
  }, []);

  const choose = useCallback(
    (hit: Hit | undefined) => {
      if (!hit) return;
      play("select");
      onPick(hit.index);
      setOpen(false);
      setQuery("");
      setActive(0);
    },
    [onPick]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      if (
        (e.key === "k" && (e.metaKey || e.ctrlKey)) ||
        (e.key === "/" && !typing)
      ) {
        e.preventDefault();
        setOpen(true);
        play("search");
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(hits.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(hits[active]);
    }
  };

  return (
    <div className={`atlas-search${open ? " is-open" : ""}`}>
      <div className="atlas-search-field">
        <button
          ref={triggerRef}
          type="button"
          className="atlas-search-trigger"
          aria-label="Search the dictionary"
          aria-expanded={open}
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next) {
              play("search");
              requestAnimationFrame(() => inputRef.current?.focus());
            }
          }}
        >
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <circle
              cx="7"
              cy="7"
              r="5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M11 11l4 4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <input
          ref={inputRef}
          type="search"
          className="atlas-search-input"
          placeholder="Search the dictionary"
          value={query}
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls="atlas-search-results"
          aria-activedescendant={
            hits.length ? `hit-${hits[active]?.index}` : undefined
          }
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onInputKey}
          tabIndex={open ? 0 : -1}
        />
      </div>

      {open && (
        <>
          {hits.length > 0 && (
            <ul
              id="atlas-search-results"
              className="atlas-search-results"
              role="listbox"
              aria-label="Search results"
            >
              {hits.map((hit, i) => {
                const node = atlas.nodes[hit.index]!;
                return (
                  <li
                    key={hit.index}
                    id={`hit-${hit.index}`}
                    role="option"
                    aria-selected={i === active}
                    className={i === active ? "is-active" : undefined}
                  >
                    <button type="button" onMouseDown={() => choose(hit)}>
                      <span className="hit-label">
                        <Label text={node.label} range={hit.range} />
                      </span>
                      <span className="hit-section">
                        {atlas.sections[node.section]?.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <span className="atlas-search-hint">
            {query
              ? "↑↓ navigate · ↵ select · esc close"
              : `${isMac ? "⌘" : "ctrl "}K to search`}
          </span>
        </>
      )}
      {!open && (
        <span className="atlas-search-hint">{isMac ? "⌘K" : "ctrl K"}</span>
      )}
    </div>
  );
}
