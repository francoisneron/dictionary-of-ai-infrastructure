"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Atlas } from "@/atlas/types";
import atlasData from "@/data/atlas.json";
import { play } from "@/audio/sounds";

const atlas = atlasData as unknown as Atlas;

type Props = {
  index: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
};

type Content = {
  heard: { question: string; answer: string } | null;
  definition: string;
};

/**
 * The full entry, shown when a node is selected.
 *
 * Content is read out of the server-rendered article rather than shipped again
 * as JSON: it is already in the document, so this saves the whole entries
 * payload from the client bundle and guarantees the panel and the accessible
 * fallback can never disagree.
 */
export default function EntryPanel({ index, onClose, onNavigate }: Props) {
  const [content, setContent] = useState<Content | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const node = index === null ? null : atlas.nodes[index];

  useEffect(() => {
    setExpanded(false);
    setCopied(null);
    if (!node) {
      setContent(null);
      return;
    }
    const root = document.getElementById(`entry-${node.id}`);
    setContent({
      heard: root?.querySelector(".entry-heard-q")
        ? {
            question:
              root.querySelector(".entry-heard-q")?.textContent?.trim() ?? "",
            answer:
              root.querySelector(".entry-heard-a")?.textContent?.trim() ?? "",
          }
        : null,
      definition: root?.querySelector(".entry-definition")?.innerHTML ?? "",
    });
    play("open");
  }, [node]);

  // One delegated listener for every cross-link in the body. No per-link React
  // element, so hydration cost doesn't scale with link count.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest("[data-term]");
      if (!target) return;
      e.preventDefault();
      const slug = target.getAttribute("data-term");
      const to = atlas.nodes.findIndex((n) => n.id === slug);
      if (to >= 0) onNavigate(to);
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [content, onNavigate]);

  const copyMarkdown = useCallback(async () => {
    if (!node) return;
    const root = document.getElementById(`entry-${node.id}`);
    const definition = root?.querySelector(".entry-definition");
    const paragraphs = definition
      ? [...definition.querySelectorAll("p, li")]
          .map((p) => p.textContent?.trim())
          .filter(Boolean)
      : [];
    const md = [
      `# ${node.label}`,
      "",
      node.description,
      "",
      ...paragraphs.flatMap((p) => [p, ""]),
      ...(content?.heard
        ? [
            "_Usage:_",
            "",
            `"${content.heard.question}"`,
            "",
            `"${content.heard.answer}"`,
          ]
        : []),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(md);
      setCopied("markdown");
      play("select");
    } catch {
      setCopied("failed");
    }
  }, [node, content]);

  const share = useCallback(async () => {
    if (!node) return;
    const url = `${location.origin}${location.pathname}#${node.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: node.label, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied("link");
      }
      play("select");
    } catch {
      /* dismissed */
    }
  }, [node]);

  if (!node || index === null) return null;

  const section = atlas.sections[node.section];
  // Every term this entry links to or is linked from — the full neighbourhood,
  // not just the closest few.
  const connects = [...new Set([...node.outbound, ...node.inbound])].sort(
    (a, b) => (atlas.nodes[b]?.degree ?? 0) - (atlas.nodes[a]?.degree ?? 0)
  );
  const prev = index > 0 ? atlas.nodes[index - 1] : null;
  const next = index < atlas.nodes.length - 1 ? atlas.nodes[index + 1] : null;

  return (
    <aside
      ref={panelRef}
      className="entry-panel"
      aria-label={`${node.label}, dictionary entry`}
    >
      <div className="entry-panel-scroll">
        <header className="entry-panel-head">
          <p className="entry-panel-section">{section?.title}</p>
          <p className="entry-panel-count">
            <strong>{index + 1}</strong>
            <span> / {atlas.nodes.length}</span>
          </p>
          <button
            type="button"
            className="entry-panel-close"
            onClick={() => {
              play("close");
              onClose();
            }}
            aria-label="Close entry"
          >
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <h2 className="entry-panel-title">{node.label}</h2>
        <p className="entry-panel-lede">{node.description}</p>

        {content?.heard && (
          <section className="entry-heard-block">
            <p className="entry-panel-label">Heard in the wild</p>
            <p className="heard-bubble heard-q">{content.heard.question}</p>
            <p className="heard-bubble heard-a">{content.heard.answer}</p>
          </section>
        )}

        <section className="entry-connects">
          <p className="entry-panel-label">Connects to</p>
          <ul>
            {connects.map((c) => (
              <li key={c}>
                <button type="button" onClick={() => onNavigate(c)}>
                  {atlas.nodes[c]?.label}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="entry-definition-block">
          <p className="entry-panel-label">Full definition</p>
          <div
            ref={bodyRef}
            className={`entry-panel-body${expanded ? " is-expanded" : ""}`}
            // Read from the server-rendered article above, which the generator
            // produced from dictionary/*.md — same trusted source.
            dangerouslySetInnerHTML={{ __html: content?.definition ?? "" }}
          />
          <button
            type="button"
            className="entry-readmore"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Read less" : "Read more"}
            <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
              <path
                d={expanded ? "M2 7.5L6 3.5l4 4" : "M2 4.5L6 8.5l4-4"}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </section>

        <div className="entry-actions">
          <button type="button" className="action primary" onClick={share}>
            {copied === "link" ? "Link copied" : "Share"}
          </button>
          <button type="button" className="action" onClick={copyMarkdown}>
            {copied === "markdown" ? "Copied" : "Copy markdown"}
          </button>
        </div>
      </div>

      <nav className="entry-panel-nav" aria-label="Adjacent terms">
        <button
          type="button"
          disabled={!prev}
          onClick={() => prev && onNavigate(index - 1)}
        >
          <span className="nav-dir">Prev</span>
          <span className="nav-term">{prev?.label ?? "—"}</span>
        </button>
        <button
          type="button"
          disabled={!next}
          onClick={() => next && onNavigate(index + 1)}
        >
          <span className="nav-dir">Next</span>
          <span className="nav-term">{next?.label ?? "—"}</span>
        </button>
      </nav>
    </aside>
  );
}
