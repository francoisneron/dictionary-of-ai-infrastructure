"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AtlasCanvas from "./AtlasCanvas";
import AtlasLabels from "./AtlasLabels";
import AtlasSearch from "./AtlasSearch";
import EntryPanel from "./EntryPanel";
import LoadingScreen from "./LoadingScreen";
import { ColorToggle, SoundToggle, InfoModal } from "./Chrome";
import type { AtlasController } from "@/atlas/AtlasController";
import type { Atlas } from "@/atlas/types";
import atlasData from "@/data/atlas.json";
import meta from "@/data/meta.json";
import { play, unlockAudio } from "@/audio/sounds";
import {
  DEFAULT_PAGE_THEME,
  PAGE_THEME_VARS,
  sectionPageTheme,
} from "@/atlas/palette";

const atlas = atlasData as unknown as Atlas;

/**
 * Root of the interactive layer. Holds the controller and the low-frequency
 * state; everything that changes at frame rate stays inside the controller.
 */
export default function Experience() {
  const [controller, setController] = useState<AtlasController | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [colorMode, setColorMode] = useState(false);
  const [muted, setMutedState] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const controllerRef = useRef<AtlasController | null>(null);

  const onReady = useCallback((c: AtlasController) => {
    controllerRef.current = c;
    setController(c);
  }, []);

  // The AudioContext is built on the first real gesture. Constructing it any
  // earlier leaves it suspended and silently eating the first few sounds.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Which section the page is dressed in with nothing open. Rolled in an effect
  // rather than during render: a random value picked while rendering differs
  // between the server pass and the first client pass, which is a hydration
  // mismatch by construction.
  const [idleSection, setIdleSection] = useState(0);
  useEffect(() => {
    if (!colorMode || selected !== null) return;
    setIdleSection(Math.floor(Math.random() * atlas.sections.length));
    // Deliberately not depending on idleSection — that would re-run on its own
    // result and never settle. This fires on entering the state, which is what
    // "randomise it" means: a fresh colour each time you come back to the map.
  }, [colorMode, selected]);

  // Colour mode always dresses the whole page. With a term open the page takes
  // that term's section; with nothing open it takes a section at random, so the
  // map is never left in a default that belongs to no section in particular.
  const washed = colorMode;
  const section =
    selected === null ? idleSection : (atlas.nodes[selected]?.section ?? 0);
  // Memoised on the section rather than rebuilt each render: this object is an
  // effect dependency, and a fresh one every render would re-apply the theme
  // on every unrelated state change.
  const theme = useMemo(
    () => (washed ? sectionPageTheme(section) : DEFAULT_PAGE_THEME),
    [washed, section]
  );

  useEffect(() => {
    controller?.setTheme(theme.paper, theme.ink);
    // Every colour in the stylesheet resolves through these properties, so
    // overriding them on the root element re-dresses the panel, the labels and
    // the chrome without any of them knowing a section exists. Removing them
    // hands control back to the stylesheet rather than freezing the default as
    // an inline value.
    const root = document.documentElement;
    for (const k of PAGE_THEME_VARS) {
      const v = theme.vars[k];
      if (v) root.style.setProperty(k, v);
      else root.style.removeProperty(k);
    }
  }, [controller, theme]);

  // Keep the camera aware of how much of the viewport the panel is covering, so
  // a selected node is never flown to a position underneath it. On narrow
  // screens the panel is full width and there is nowhere to shift to, so the
  // inset drops back to zero.
  useEffect(() => {
    const update = () => {
      const panelWidth = Math.min(470, window.innerWidth);
      const covered = selected !== null && window.innerWidth > panelWidth + 240;
      controller?.setInsetRight(covered ? panelWidth : 0);
      // The floating chrome reads this to step aside from the panel.
      const root = document.documentElement;
      root.style.setProperty(
        "--panel-width",
        covered ? `${panelWidth}px` : "0px"
      );
      // Open but too narrow to step around means the panel is the whole
      // viewport, and there is nowhere for the chrome to move to. Flagged here
      // rather than as a CSS breakpoint so the width stays defined in one place.
      root.classList.toggle("panel-fills-view", selected !== null && !covered);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [controller, selected]);

  const goTo = useCallback((index: number) => {
    const c = controllerRef.current;
    setSelected(index);
    c?.select(index);
    // Set the inset before flying, so the first selection is offset too rather
    // than only every one after it.
    const panelWidth = Math.min(470, window.innerWidth);
    c?.setInsetRight(window.innerWidth > panelWidth + 240 ? panelWidth : 0);
    c?.flyTo(index);
    play("fly");
  }, []);

  // Read inside `clear` without making it depend on the value: the callback is
  // handed to a key listener and to the canvas, and re-binding those on every
  // selection is what the ref avoids.
  const selectedRef = useRef<number | null>(null);
  selectedRef.current = selected;

  const clear = useCallback(() => {
    // Nothing open means nothing to close. Without this, clicking empty space
    // while reading the map would throw away a camera the reader had just
    // orbited and zoomed to where they wanted it.
    if (selectedRef.current === null) return;
    setSelected(null);
    const c = controllerRef.current;
    c?.select(null);
    // Closing a term pulls back to the whole map, which is the view that makes
    // sense to land on: the alternative leaves you at reading distance from a
    // node you just dismissed, with no sense of where you are.
    c?.resetView();
  }, []);

  // Clicking the canvas has to travel the same path as clicking a label or a
  // search result. Wired straight to setSelected it opened the panel while the
  // renderer's focus stayed unset, so the map never reacted to its own click.
  const onCanvasSelect = useCallback(
    (index: number | null) => {
      if (index === null) clear();
      else goTo(index);
    },
    [goTo, clear]
  );

  // Global keys that belong to the map rather than to any one control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (e.key === "Escape") clear();
      if (e.key === "0") controllerRef.current?.resetView();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clear]);

  if (unsupported) {
    return (
      <div className="no-webgl">
        <header>
          <h1>The AI Infrastructure Dictionary</h1>
          <p>
            This browser doesn&apos;t support WebGL2, so the map can&apos;t
            render. The complete dictionary — {meta.terms} terms across{" "}
            {meta.sections} sections — is below.
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="experience">
      <AtlasCanvas
        onReady={onReady}
        onSelect={onCanvasSelect}
        onUnsupported={() => setUnsupported(true)}
      />
      <AtlasLabels controller={controller} onSelect={goTo} />

      <AtlasSearch onPick={goTo} />

      <EntryPanel index={selected} onClose={clear} onNavigate={goTo} />

      <div className="chrome-corner chrome-corner-tr">
        <InfoModal
          open={infoOpen}
          onOpen={() => setInfoOpen(true)}
          onClose={() => setInfoOpen(false)}
        />
      </div>

      <div className="chrome-corner chrome-corner-br">
        <ColorToggle on={colorMode} onToggle={() => setColorMode((v) => !v)} />
        <SoundToggle muted={muted} onToggle={() => setMutedState((v) => !v)} />
      </div>

      <p className="atlas-status" aria-hidden="true">
        {meta.terms} terms · {meta.edges} links · {meta.backboneEdges} backbone
      </p>

      <LoadingScreen ready={controller !== null} />
    </div>
  );
}
