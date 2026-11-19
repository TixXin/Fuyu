import { useCallback, useRef, useState } from "react";
import { nextTuckSource, type TuckEvent, type TuckSource } from "./tuckRecall";
import type { IslandMode, IslandPage } from "./types";

export function useIslandNavigation() {
  const [mode, setMode] = useState<IslandMode>("collapsed");
  const [isTucked, setIsTucked] = useState(false);
  const [isPeekTuck, setIsPeekTuck] = useState(false);
  const [tuckSource, setTuckSource] = useState<TuckSource>(null);
  const [openedByHover, setOpenedByHover] = useState(false);
  const [peekRetractDelayMs, setPeekRetractDelayMs] = useState<number | null>(null);
  const [page, setPage] = useState<IslandPage>("todo");
  const clipboardShortcutToggleAt = useRef(0);
  const markTuck = useCallback((event: TuckEvent) => {
    setTuckSource((source) => nextTuckSource(source, event));
  }, []);

  const setIslandMode = useCallback((nextMode: IslandMode) => {
    setMode(nextMode);
    setIsTucked(false);
    setIsPeekTuck(false);
    setOpenedByHover(false);
    markTuck("setMode");
  }, [markTuck]);

  const collapseIsland = useCallback(() => {
    setMode("collapsed");
    setIsTucked(false);
    setOpenedByHover(false);
    markTuck("collapse");
  }, [markTuck]);

  const tuckIsland = useCallback(() => {
    setIslandMode("collapsed");
    setIsTucked(true);
    markTuck("tuckIsland");
  }, [markTuck, setIslandMode]);

  const minimizeToEdge = useCallback(() => {
    setIslandMode("collapsed");
    setIsTucked(true);
    setIsPeekTuck(true);
    setPeekRetractDelayMs(null);
    markTuck("minimizeToEdge");
  }, [markTuck, setIslandMode]);

  const idleTuck = useCallback((retractDelayMs: number | null) => {
    setIslandMode("collapsed");
    setIsTucked(true);
    setIsPeekTuck(retractDelayMs !== null);
    setPeekRetractDelayMs(retractDelayMs);
    markTuck("idleTuck");
  }, [markTuck, setIslandMode]);

  const revealIsland = useCallback(() => {
    setIsTucked(false);
    setIsPeekTuck(false);
    markTuck("reveal");
  }, [markTuck]);

  const peekIsland = useCallback(() => {
    setIsTucked(false);
  }, []);

  const endPeek = useCallback(() => {
    setMode("collapsed");
    setIsTucked(true);
    setOpenedByHover(false);
    markTuck("endPeek");
  }, [markTuck]);

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
    markTuck("setMode");
  }, [markTuck]);

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
    tuckSource,
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
