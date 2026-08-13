"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    controller?.setColorMode(colorMode);
  }, [controller, colorMode]);

  // Keep the camera aware of how much of the viewport the panel is covering, so
  // a selected node is never flown to a position underneath it. On narrow
  // screens the panel is full width and there is nowhere to shift to, so the
  // inset drops back to zero.
  useEffect(() => {
    const update = () => {
      const panelWidth = Math.min(470, window.innerWidth);
      const covered = selected !== null && window.innerWidth > panelWidth + 240;
      controller?.setInsetRight(covered ? panelWidth : 0);
      // Chrome in the bottom-right reads this to step aside from the panel.
      document.documentElement.style.setProperty(
        "--panel-width",
        covered ? `${panelWidth}px` : "0px"
      );
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

  const clear = useCallback(() => {
    setSelected(null);
    controllerRef.current?.select(null);
  }, []);

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
        onSelect={setSelected}
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
