import { useCallback, useEffect, useRef, useState } from "react";
import type { SideDockEdge, SideDocksSettings } from "../../lib/settings/sideDocks";
import { MOTION_BASE_MS } from "../../lib/theme/motionTokens";
import { useReducedMotion } from "../../lib/theme/useReducedMotion";
import { listenSideDockHover, listenSideDockOpenPage, setSideDockGeometry } from "./api";
import { sideDockWindowSize, stripHeightFor, stripWidthFor, targetVisualStateOnTrigger, type SideDockVisualState } from "./dockGeometry";

type UseSideDockStateArgs = {
  edge: SideDockEdge;
  sideDocks: SideDocksSettings;
  saveSideDocks: (next: SideDocksSettings) => void;
  stripCount: number;
};

export function useSideDockState({ edge, sideDocks, saveSideDocks, stripCount }: UseSideDockStateArgs) {
  const sideConfig = sideDocks[edge];
  const reducedMotion = useReducedMotion();
  const [visualState, setVisualState] = useState<SideDockVisualState>(sideConfig.pinned ? "drawer" : "handle");
  const [closing, setClosing] = useState(false);
  const [activePage, setActivePage] = useState<string | null>(sideConfig.lastPage);
  const [handleHovered, setHandleHovered] = useState(false);

  const hoverTimerRef = useRef<number | null>(null);
  const leaveTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const stateRef = useRef({ visualState, closing, sideDocks, sideConfig, stripCount, reducedMotion });
  stateRef.current = { visualState, closing, sideDocks, sideConfig, stripCount, reducedMotion };

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
    const { sideDocks: latest, sideConfig: cfg, visualState: vs } = stateRef.current;
    if (latest.trigger !== "hover" || cfg.pinned || vs === "handle") return;
    if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = window.setTimeout(() => {
      leaveTimerRef.current = null;
      const focused = document.activeElement as HTMLElement | null;
      if (focused && (focused.tagName === "INPUT" || focused.tagName === "TEXTAREA" || focused.isContentEditable)) return;
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
    if (sideConfig.pinned && visualState !== "drawer") {
      clearTimers();
      setClosing(false);
      setVisualState("drawer");
    }
  }, [clearTimers, sideConfig.pinned, visualState]);

  useEffect(() => {
    if (visualState === "strip" && (sideDocks.stages === 2 || stripCount === 0)) {
      setVisualState("drawer");
    }
  }, [sideDocks.stages, stripCount, visualState]);

  useEffect(() => {
    let cancelled = false;
    let disposeOpen: (() => void) | null = null;
    let disposeHover: (() => void) | null = null;
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
    return () => {
      cancelled = true;
      disposeOpen?.();
      disposeHover?.();
    };
  }, [clearTimers, edge, handleHoverChange]);

  useEffect(() => {
    const onBlur = () => {
      const { sideDocks: latest, sideConfig: cfg, visualState: vs } = stateRef.current;
      if (latest.trigger === "click" && !cfg.pinned && vs !== "handle") {
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
    if (sideConfig.pinned) {
      saveSideDocks({ ...sideDocks, [edge]: { ...sideConfig, pinned: false } });
    }
    collapseToHandle();
  }, [collapseToHandle, edge, saveSideDocks, sideConfig, sideDocks]);

  return {
    visualState,
    closing,
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
