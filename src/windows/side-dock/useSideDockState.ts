import { useCallback, useEffect, useRef, useState } from "react";
import type { SideDockEdge, SideDocksSettings } from "../../lib/settings/sideDocks";
import { MOTION_BASE_MS } from "../../lib/theme/motionTokens";
import { useReducedMotion } from "../../lib/theme/useReducedMotion";
import { listenSideDockHover, listenSideDockOpenPage, listenSideDockPreview, setSideDockGeometry } from "./api";
import { sideDockWindowSize, stripHeightFor, stripWidthFor, targetVisualStateOnTrigger, type SideDockVisualState } from "./dockGeometry";

type UseSideDockStateArgs = {
  edge: SideDockEdge;
  sideDocks: SideDocksSettings;
  saveSideDocks: (next: SideDocksSettings) => void;
  stripCount: number;
};

const POPUP_SELECTOR = "[role='menu'], [role='listbox'], [role='dialog'], [aria-expanded='true']";

function hasActiveInteraction(): boolean {
  const focused = document.activeElement as HTMLElement | null;
  if (
    focused &&
    (focused.tagName === "INPUT" ||
      focused.tagName === "TEXTAREA" ||
      focused.tagName === "SELECT" ||
      focused.isContentEditable)
  ) {
    return true;
  }
  return document.querySelector(POPUP_SELECTOR) !== null;
}

export function useSideDockState({ edge, sideDocks, saveSideDocks, stripCount }: UseSideDockStateArgs) {
  const sideConfig = sideDocks[edge];
  const reducedMotion = useReducedMotion();
  const [visualState, setVisualState] = useState<SideDockVisualState>(sideConfig.pinned ? "drawer" : "handle");
  const [closing, setClosing] = useState(false);
  const [previewHold, setPreviewHold] = useState(false);
  const [activePage, setActivePage] = useState<string | null>(sideConfig.lastPage);
  const [handleHovered, setHandleHovered] = useState(false);

  const hoverTimerRef = useRef<number | null>(null);
  const leaveTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const composingRef = useRef(false);
  const pointerDownRef = useRef(false);
  const stateRef = useRef({ visualState, closing, previewHold, sideDocks, sideConfig, stripCount, reducedMotion });
  stateRef.current = { visualState, closing, previewHold, sideDocks, sideConfig, stripCount, reducedMotion };

  const clearTimers = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const collapseToHandle = useCallback(() => {
    clearTimers();
    const current = stateRef.current;
    if (current.visualState === "handle") {
      setClosing(false);
      return;
    }
    if (current.reducedMotion) {
      setClosing(false);
      setVisualState("handle");
      return;
    }
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setClosing(false);
      setVisualState("handle");
    }, MOTION_BASE_MS);
  }, [clearTimers]);

  const openOnTrigger = useCallback(() => {
    clearTimers();
    setClosing(false);
    const { sideDocks: latest, stripCount: count } = stateRef.current;
    setVisualState(targetVisualStateOnTrigger(latest, count));
  }, [clearTimers]);

  const scheduleLeave = useCallback(() => {
    const { sideDocks: latest, sideConfig: cfg, visualState: vs, previewHold: holding } = stateRef.current;
    if (latest.trigger !== "hover" || cfg.pinned || holding || vs === "handle") return;
    if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = window.setTimeout(() => {
      leaveTimerRef.current = null;
      if (composingRef.current || pointerDownRef.current || hasActiveInteraction()) return;
      collapseToHandle();
    }, latest.leaveDelayMs);
  }, [collapseToHandle]);

  const handleHoverChange = useCallback(
    (inside: boolean) => {
      setHandleHovered(inside);
      const { sideDocks: latest, visualState: vs } = stateRef.current;
      if (inside) {
        clearTimers();
        setClosing(false);
        if (vs === "handle" && latest.trigger === "hover") {
          if (latest.hoverDelayMs <= 0) {
            openOnTrigger();
          } else {
            hoverTimerRef.current = window.setTimeout(() => {
              hoverTimerRef.current = null;
              openOnTrigger();
            }, latest.hoverDelayMs);
          }
        }
        return;
      }
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      scheduleLeave();
    },
    [clearTimers, openOnTrigger, scheduleLeave],
  );

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    const onCompStart = () => { composingRef.current = true; };
    const onCompEnd = () => { composingRef.current = false; };
    const onDown = () => { pointerDownRef.current = true; };
    const onUp = () => { pointerDownRef.current = false; };
    window.addEventListener("compositionstart", onCompStart, true);
    window.addEventListener("compositionend", onCompEnd, true);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    return () => {
      window.removeEventListener("compositionstart", onCompStart, true);
      window.removeEventListener("compositionend", onCompEnd, true);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };
  }, []);

  useEffect(() => {
    const hasStrip = sideDocks.stages === 3 && stripCount > 0;
    const size = sideDockWindowSize(sideDocks, visualState, stripCount);
    const shape = {
      expanded: visualState !== "handle",
      stripWidth: hasStrip ? stripWidthFor(sideDocks) : 0,
      stripHeight: hasStrip ? stripHeightFor(stripCount, sideDocks) : 0,
      gap: hasStrip ? sideDocks.gap : 0,
    };
    void setSideDockGeometry(edge, size.width, size.height, sideConfig.along, shape).catch(() => undefined);
  }, [edge, sideConfig.along, sideDocks, stripCount, visualState]);

  useEffect(() => {
    if ((sideConfig.pinned || previewHold) && visualState !== "drawer") {
      clearTimers();
      setClosing(false);
      setVisualState("drawer");
    }
  }, [clearTimers, previewHold, sideConfig.pinned, visualState]);

  useEffect(() => {
    if (visualState === "strip" && (sideDocks.stages === 2 || stripCount === 0)) {
      setVisualState("drawer");
    }
  }, [sideDocks.stages, stripCount, visualState]);

  useEffect(() => {
    let cancelled = false;
    let disposeOpen: (() => void) | null = null;
    let disposeHover: (() => void) | null = null;
    let disposePreview: (() => void) | null = null;
    void listenSideDockOpenPage(edge, (pageId) => {
      clearTimers();
      setClosing(false);
      setActivePage(pageId);
      setVisualState("drawer");
    }).then((dispose) => {
      if (cancelled) dispose();
      else disposeOpen = dispose;
    });
    void listenSideDockHover(edge, handleHoverChange).then((dispose) => {
      if (cancelled) dispose();
      else disposeHover = dispose;
    });
    void listenSideDockPreview(edge, (open) => {
      clearTimers();
      setClosing(false);
      setPreviewHold(open);
      if (open) setVisualState("drawer");
      else if (!stateRef.current.sideConfig.pinned) collapseToHandle();
    }).then((dispose) => {
      if (cancelled) dispose();
      else disposePreview = dispose;
    });
    return () => {
      cancelled = true;
      disposeOpen?.();
      disposeHover?.();
      disposePreview?.();
    };
  }, [clearTimers, collapseToHandle, edge, handleHoverChange]);

  useEffect(() => {
    const onBlur = () => {
      const { sideDocks: latest, sideConfig: cfg, visualState: vs, previewHold: holding } = stateRef.current;
      if (latest.trigger === "click" && !cfg.pinned && !holding && vs !== "handle") {
        collapseToHandle();
      }
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [collapseToHandle]);

  const togglePin = useCallback(() => {
    saveSideDocks({ ...sideDocks, [edge]: { ...sideConfig, pinned: !sideConfig.pinned } });
  }, [edge, saveSideDocks, sideConfig, sideDocks]);

  const selectPage = useCallback(
    (pageId: string) => {
      clearTimers();
      setClosing(false);
      setActivePage(pageId);
      setVisualState("drawer");
      if (sideConfig.lastPage !== pageId) {
        saveSideDocks({ ...sideDocks, [edge]: { ...sideConfig, lastPage: pageId } });
      }
    },
    [clearTimers, edge, saveSideDocks, sideConfig, sideDocks],
  );

  const dismiss = useCallback(() => {
    setPreviewHold(false);
    if (sideConfig.pinned) {
      saveSideDocks({ ...sideDocks, [edge]: { ...sideConfig, pinned: false } });
    }
    collapseToHandle();
  }, [collapseToHandle, edge, saveSideDocks, sideConfig, sideDocks]);

  return {
    visualState,
    closing,
    previewHold,
    activePage,
    handleHovered,
    setActivePage,
    openOnTrigger,
    selectPage,
    togglePin,
    dismiss,
    handleHoverChange,
    clearTimers,
  };
}
