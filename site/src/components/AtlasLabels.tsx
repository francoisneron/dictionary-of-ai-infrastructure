"use client";

import { useEffect, useRef } from "react";
import type { AtlasController, LabelSync } from "@/atlas/AtlasController";
import type { Atlas } from "@/atlas/types";
import atlasData from "@/data/atlas.json";

const atlas = atlasData as unknown as Atlas;

type Props = {
  controller: AtlasController | null;
  onSelect: (index: number) => void;
};

/**
 * Labels are real DOM, not glyphs baked into the canvas.
 *
 * The decisive reason is font licensing: the design register is Helvetica Neue,
 * a system font that cannot legally be baked into an SDF atlas. DOM text gets
 * the exact typography for free, plus hit-testing, focus, and CSS theming.
 *
 * The usual objection — per-frame DOM cost — does not apply at 84 elements
 * updated with transform and opacity only. That is compositor work, not layout.
 *
 * This component renders once. Positions are written imperatively from the
 * render loop, so React is not involved in animation at all.
 */
export default function AtlasLabels({ controller, onSelect }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!controller) return;

    const count = atlas.nodes.length;
    /** Last frame's rank per label, for hysteresis and dwell. */
    const shownRank = new Uint8Array(count);
    const marked = new Uint8Array(count);
    const lastOpacity = new Float32Array(count);
    const lastHalo = new Float32Array(count);

    // Widths are estimated from character count rather than measured. Measuring
    // would force layout 84 times a frame, and an estimate is accurate enough
    // to decide overlap. Monospace at 9.5px with letter-spacing ≈ 6.6px/char.
    const widths = atlas.nodes.map((n) => n.label.length * 6.6 + 8);
    const H = 14;

    // Densest-first: hubs win a contested position, which keeps the landmarks
    // labelled and drops the incidental terms.
    const byDegree = atlas.nodes
      .map((_, i) => i)
      .sort((a, b) => atlas.nodes[b]!.degree - atlas.nodes[a]!.degree);

    const placedX = new Float32Array(count);
    const placedY = new Float32Array(count);
    const placedW = new Float32Array(count);
    /**
     * How prominently each label renders this frame:
     *   0 — behind the camera, the only case that hides a label outright
     *   1 — faint: it lost the placement contest, or sits below the zoom's
     *       degree floor, so it recedes instead of vanishing
     *   2 — full: it won its place
     * Every node in front of the camera keeps its name at some strength. A term
     * with no label at all reads as a node the map has nothing to say about.
     */
    const rank = new Uint8Array(count);
    /** When each label last changed rank, for the minimum-dwell rule. */
    const flippedAt = new Float64Array(count);

    // A label already on screen defends its place: its collision box shrinks by
    // this much, so a neighbour has to overlap properly before evicting it.
    // Without the asymmetry, two labels grazing each other trade places every
    // few frames as the map turns, which is what reads as flicker.
    const HYSTERESIS = 11;
    /** And once shown or hidden, it holds that state for at least this long. */
    const DWELL_MS = 1300;
    /** Slightly longer than the CSS opacity ramp, so a label keeps tracking its
     *  node until it has finished fading out. */
    const FADE_MS = 240;
    /** No label in front of the camera ever reaches zero. A node with no name
     *  reads as one the map has nothing to say about, which is never true. */
    const MIN_OPACITY = 0.14;
    /** The most a faint label reaches, at the very front of the graph. Low
     *  enough that the placed labels still carry the reading. */
    const FAINT_CEILING = 0.3;

    // Neighbours as a lookup rather than `Array.includes` per node per frame:
    // that was two O(n·k) scans every frame to answer a question that only
    // changes when the lit term does.
    const isNeighbour = new Uint8Array(count);
    let litCache = -2;

    const sync: LabelSync = (projected, lod, hover, focus) => {
      // Hover wins over selection for the neighbourhood highlight: while a term
      // is open you can still point at any other node and read what it is.
      const lit = hover >= 0 ? hover : focus;
      if (lit !== litCache) {
        litCache = lit;
        isNeighbour.fill(0);
        const rel = lit >= 0 ? atlas.nodes[lit]?.related : null;
        if (rel) for (const r of rel) isNeighbour[r] = 1;
      }

      rank.fill(0);
      let placed = 0;
      const now = performance.now();

      for (const i of byDegree) {
        const node = atlas.nodes[i]!;
        const depth = projected[i * 4 + 2]!;
        if (depth <= 0) continue; // behind the camera: the one real hide

        // In front of the camera, so it is named. Everything below decides how
        // strongly, not whether.
        rank[i] = 1;

        // Always legible: whatever is hovered or selected, regardless of zoom
        // or how crowded that part of the map is.
        const active = i === hover || i === focus;
        const related = isNeighbour[i] === 1;
        // A label already at full strength is judged against the more generous
        // hold floor, so a term sitting exactly on the threshold does not flip
        // back and forth as the camera distance wobbles across it.
        const floor =
          shownRank[i] === 2 ? lod.labelDegreeFloorHold : lod.labelDegreeFloor;
        if (!active && !related && node.degree < floor) continue;

        // Centred above the node, clear of its disc at whatever size it renders.
        const radius = projected[i * 4 + 3]!;
        const w = widths[i]!;
        const x = projected[i * 4]! - w / 2;
        const y = projected[i * 4 + 1]! - radius - 6 - H;

        const wasFull = shownRank[i] === 2;
        const held = wasFull && now - flippedAt[i]! < DWELL_MS;

        if (!active && !related && !held) {
          const inset = wasFull ? HYSTERESIS : 0;
          let collides = false;
          // Only full-strength labels reserve space. Faint ones are allowed to
          // sit under each other — they are there to say a term exists, and
          // making them compete would put us back to hiding most of the map.
          for (let p = 0; p < placed; p++) {
            if (
              x + inset < placedX[p]! + placedW[p]! &&
              x + w - inset > placedX[p]! &&
              y + inset < placedY[p]! + H &&
              y + H - inset > placedY[p]!
            ) {
              collides = true;
              break;
            }
          }
          if (collides) continue;
        }

        placedX[placed] = x;
        placedY[placed] = y;
        placedW[placed] = w;
        placed++;
        rank[i] = 2;
      }

      for (let i = 0; i < count; i++) {
        const el = refs.current[i];
        if (!el) continue;

        const next = rank[i]!;
        // Only a label behind the camera and done fading needs no transform.
        // Each write skipped is a style invalidation the compositor would
        // otherwise have to reconcile.
        if (next > 0 || shownRank[i]! > 0 || now - flippedAt[i]! < FADE_MS) {
          const x = projected[i * 4]!;
          const y = projected[i * 4 + 1]! - projected[i * 4 + 3]! - 6;
          // translate(-50%,-100%) centres the pill and lifts it off the disc.
          el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
        }

        if (shownRank[i] !== next) {
          shownRank[i] = next;
          flippedAt[i] = now;
          el.classList.toggle("is-visible", next > 0);
          // Faint labels are not click targets. Rendering all eighty-four makes
          // the dense middle a mat of overlapping buttons, and the canvas would
          // stop receiving the drags that turn the map.
          el.classList.toggle("is-faint", next === 1);
        }

        const active = i === hover || i === focus;
        const related = isNeighbour[i] === 1;
        // Related labels come forward on opacity alone (below); only the
        // active label carries a class.
        const mark = active ? 2 : related ? 1 : 0;
        if (marked[i] !== mark) {
          marked[i] = mark;
          el.classList.toggle("is-active", mark === 2);
        }

        // Behind the camera ramps to zero rather than relying on the stylesheet,
        // because this inline value always wins over the class — left alone it
        // would blink out on `visibility` with no fade at all.
        if (next === 0) {
          if (lastOpacity[i] !== 0) {
            lastOpacity[i] = 0;
            el.style.opacity = "0";
          }
          continue;
        }

        const depth = projected[i * 4 + 2]!;
        // Normalised over the frame's measured depth range, so t genuinely
        // spans 0 at the nearest node to 1 at the furthest.
        const t = Math.min(
          1,
          Math.max(
            0,
            (depth - lod.fadeNear) / Math.max(lod.fadeFar - lod.fadeNear, 1e-3)
          )
        );
        // Depth still recedes, but between a floor and a ceiling rather than
        // down to nothing: the back of the graph reads as almost gone without
        // any term losing its name. A faint label's ceiling is low enough that
        // the ones that won their place still read as the labels.
        const faded = 1 - 0.96 * Math.pow(t, 1.15);
        const ceiling = next === 2 ? 1 : FAINT_CEILING;
        const graded = MIN_OPACITY + (ceiling - MIN_OPACITY) * faded;
        const target = mark > 0 ? 1 : Math.round(graded * 50) / 50;
        // Only write on a real change, with a deadband: quantising alone still
        // churns when a drifting value sits astride a step boundary.
        if (Math.abs(lastOpacity[i]! - target) > 0.015) {
          lastOpacity[i] = target;
          el.style.opacity = String(target);
        }
        // The paper halo recedes with the text but more gently — near the front
        // it is what makes a label readable over dense nodes and edges.
        const halo = mark > 0 ? 1 : Math.round((1 - 0.85 * t) * 20) / 20;
        if (Math.abs(lastHalo[i]! - halo) > 0.03) {
          lastHalo[i] = halo;
          el.style.setProperty("--halo", String(halo));
        }
      }
    };

    controller.setLabelSync(sync);
    return () => controller.setLabelSync(null);
  }, [controller]);

  return (
    <div className="atlas-labels">
      {atlas.nodes.map((n, i) => (
        <button
          key={n.id}
          type="button"
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="atlas-label"
          data-section={n.section}
          aria-describedby={`desc-${n.id}`}
          onClick={() => onSelectRef.current(i)}
          onFocus={() => controller?.flyTo(i)}
        >
          <span className="atlas-label-text">{n.label}</span>
          <span id={`desc-${n.id}`} className="sr-only">
            {n.description} Section {n.section + 1}. {n.degree} connections.
          </span>
        </button>
      ))}
    </div>
  );
}
