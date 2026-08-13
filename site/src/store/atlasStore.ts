// A tiny external store for the low-frequency UI state.
//
// The rule this exists to enforce: nothing that changes at frame rate goes
// through React. Camera, hover and tween state live in the controller; only
// user-intentional, low-frequency state lives here. Per-slice selectors mean
// the colour toggle re-renders on a colour change and nothing else does.

import { useSyncExternalStore } from "react";

export type Phase = "loading" | "ready";

export type AtlasState = {
  phase: Phase;
  loadProgress: number;
  selected: number | null;
  colorMode: boolean;
  muted: boolean;
  searchOpen: boolean;
  infoOpen: boolean;
};

let state: AtlasState = {
  phase: "loading",
  loadProgress: 0,
  selected: null,
  colorMode: false,
  // Default muted. Unsolicited audio is hostile, and it sidesteps the autoplay
  // fight entirely — the toggle renders off and invites turning it on.
  muted: true,
  searchOpen: false,
  infoOpen: false,
};

const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): AtlasState {
  return state;
}

export function setState(patch: Partial<AtlasState>): void {
  let changed = false;
  for (const k of Object.keys(patch) as (keyof AtlasState)[]) {
    if (state[k] !== patch[k]) {
      changed = true;
      break;
    }
  }
  if (!changed) return;
  state = { ...state, ...patch };
  emit();
}

/**
 * Server snapshot returns the same object as the client's initial state, so the
 * first client render matches the HTML. Anything read from localStorage or from
 * platform detection has to be applied in an effect, not here.
 */
export function useAtlas<T>(select: (s: AtlasState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(state),
    () => select(state)
  );
}
