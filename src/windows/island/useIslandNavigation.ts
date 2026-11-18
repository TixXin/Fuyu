import { useCallback, useRef, useState } from "react";
import type { IslandMode, IslandPage } from "./types";

export function useIslandNavigation() {
  const [mode, setMode] = useState<IslandMode>("collapsed");
  const [isTucked, setIsTucked] = useState(false);
  const [isPeekTuck, setIsPeekTuck] = useState(false);
  const [openedByHover, setOpenedByHover] = useState(false);
  const [peekRetractDelayMs, setPeekRetractDelayMs] = useState<number | null>(null);
  const [page, setPage] = useState<IslandPage>("todo");
  const clipboardShortcutToggleAt = useRef(0);

  const setIslandMode = useCallback((nextMode: IslandMode) => {
    setMode(nextMode);
    setIsTucked(false);
    setIsPeekTuck(false);
    setOpenedByHover(false);
  }, []);

  const collapseIsland = useCallback(() => {
    setMode("collapsed");
    setIsTucked(false);
    setOpenedByHover(false);
  }, []);

  const tuckIsland = useCallback(() => {
    setIslandMode("collapsed");
    setIsTucked(true);
  }, [setIslandMode]);

  const minimizeToEdge = useCallback(() => {
    setIslandMode("collapsed");
    setIsTucked(true);
    setIsPeekTuck(true);
    setPeekRetractDelayMs(null);
  }, [setIslandMode]);

  const idleTuck = useCallback((retractDelayMs: number | null) => {
    setIslandMode("collapsed");
    setIsTucked(true);
    setIsPeekTuck(retractDelayMs !== null);
    setPeekRetractDelayMs(retractDelayMs);
  }, [setIslandMode]);

  const revealIsland = useCallback(() => {
    setIsTucked(false);
    setIsPeekTuck(false);
  }, []);

  const peekIsland = useCallback(() => {
    setIsTucked(false);
  }, []);

  const endPeek = useCallback(() => {
    setMode("collapsed");
    setIsTucked(true);
    setOpenedByHover(false);
  }, []);

  const resumePeek = useCallback(() => {
    setIsPeekTuck(true);
  }, []);

  const markHoverOpen = useCallback(() => {
    setOpenedByHover(true);
  }, []);

  const openIslandPage = useCallback((nextPage: IslandPage) => {
    setPage(nextPage);
    setMode("expanded");
    setIsTucked(false);
    setIsPeekTuck(false);
    setOpenedByHover(false);
  }, []);

  const openClipboardHistory = useCallback(() => {
    openIslandPage("clipboard");
  }, [openIslandPage]);

  const toggleClipboardHistory = useCallback(() => {
    const now = Date.now();

    if (now - clipboardShortcutToggleAt.current < 250) {
      return;
    }

    clipboardShortcutToggleAt.current = now;

    if (mode === "expanded" && page === "clipboard") {
      setIslandMode("collapsed");
      return;
    }

    openClipboardHistory();
  }, [mode, openClipboardHistory, page, setIslandMode]);

  return {
    mode,
    isTucked,
    isPeeking: isPeekTuck && !isTucked,
    openedByHover: mode === "expanded" && openedByHover,
    retractsAfterPeek: isPeekTuck,
    peekRetractDelayMs,
    page,
    setPage,
    collapseIsland,
    tuckIsland,
    revealIsland,
    minimizeToEdge,
    idleTuck,
    peekIsland,
    endPeek,
    resumePeek,
    markHoverOpen,
    openIslandPage,
    toggleClipboardHistory,
  };
}
