import { useEffect, useRef } from "react";
import { listenIslandExpandShortcut } from "../../lib/island-expand/api";
import { useIslandExpandShortcut } from "../../lib/island-expand/useIslandExpandShortcut";
import type { IslandMode, IslandPage } from "./types";

const TOGGLE_DEBOUNCE_MS = 200;

export function useIslandExpandToggle({
  shortcut,
  mode,
  homePage,
  openEnabledPage,
  collapseIsland,
}: {
  shortcut: string;
  mode: IslandMode;
  homePage: IslandPage;
  openEnabledPage: (page: IslandPage) => void;
  collapseIsland: () => void;
}) {
  useIslandExpandShortcut(shortcut);
  const latest = useRef({ mode, homePage, openEnabledPage, collapseIsland });
  const toggledAt = useRef(0);

  useEffect(() => {
    latest.current = { mode, homePage, openEnabledPage, collapseIsland };
  });

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    void listenIslandExpandShortcut(() => {
      const now = Date.now();
      if (now - toggledAt.current < TOGGLE_DEBOUNCE_MS) return;
      toggledAt.current = now;
      const current = latest.current;
      if (current.mode === "expanded") current.collapseIsland();
      else current.openEnabledPage(current.homePage);
    })
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch((error: unknown) => console.error("Failed to listen for the island expand shortcut", error));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
}
