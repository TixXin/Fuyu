import { useCallback, useEffect, useRef, useState } from "react";
import type { SideDockEdge, SideDocksSettings } from "../../lib/settings/sideDocks";
import { MOTION_BASE_MS } from "../../lib/theme/motionTokens";
import { useReducedMotion } from "../../lib/theme/useReducedMotion";
import { listenSideDockHover, listenSideDockOpenPage, listenSideDockPreview, setSideDockGeometry } from "./api";
import { sideDockWindowSize, stripHeightFor, stripWidthFor, targetVisualStateOnTrigger, type SideDockVisualState } from "./dockGeometry";

export type SideDockMotionPhase = "idle" | "preparing" | "open" | "closing";

type UseSideDockStateArgs = {
  edge: SideDockEdge;
  sideDocks: SideDocksSettings;
  saveSideDocks: (next: SideDocksSettings) => void;
  stripCount: number;
  instantMotion: boolean;
};

const POPUP_SELECTOR = "[role='menu'], [role='listbox'], [role='dialog'], [aria-expanded='true']";
const STRIP_HOVER_INTENT_MS = 65;

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

function buildGeometryArgs(sideDocks: SideDocksSettings, visualState: SideDockVisualState, stripCount: number) {
  const hasStrip = sideDocks.stages === 3 && stripCount > 0;
  const size = sideDockWindowSize(sideDocks, visualState, stripCount);
  const shape = {
    expanded: visualState !== "handle",
    stripWidth: hasStrip ? stripWidthFor(sideDocks) : 0,
    stripHeight: hasStrip ? stripHeightFor(stripCount, sideDocks) : 0,
    gap: hasStrip ? sideDocks.gap : 0,
  };
  return { size, shape };
}

export function useSideDockState({ edge, sideDocks, saveSideDocks, stripCount, instantMotion }: UseSideDockStateArgs) {
  const sideConfig = sideDocks[edge];
  const reducedMotion = useReducedMotion();
  const skipMotion = reducedMotion || instantMotion;
  const [visualState, setVisualState] = useState<SideDockVisualState>(sideConfig.pinned ? "drawer" : "handle");
  const [phase, setPhase] = useState<SideDockMotionPhase>(sideConfig.pinned ? "open" : "idle");
  const [drawerPhase, setDrawerPhase] = useState<SideDockMotionPhase>(sideConfig.pinned ? "open" : "idle");
  const [previewHold, setPreviewHold] = useState(false);
  const [activePage, setActivePage] = useState<string | null>(sideConfig.lastPage);
  const [handleHovered, setHandleHovered] = useState(false);

  const hoverTimerRef = useRef<number | null>(null);
  const leaveTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const stripIntentRef = useRef<number | null>(null);
  const openSeqRef = useRef(0);
  const rafOneRef = useRef<number | null>(null);
  const rafTwoRef = useRef<number | null>(null);
  const composingRef = useRef(false);
  const pointerDownRef = useRef(false);

  const stateRef = useRef({ visualState, phase, drawerPhase, previewHold, sideDocks, sideConfig, stripCount, skipMotion });
  stateRef.current = { visualState, phase, drawerPhase, previewHold, sideDocks, sideConfig, stripCount, skipMotion };

  const clearFrames = useCallback(() => {
    if (rafOneRef.current !== null) {
      window.cancelAnimationFrame(rafOneRef.current);
      rafOneRef.current = null;
    }
    if (rafTwoRef.current !== null) {
      window.cancelAnimationFrame(rafTwoRef.current);
      rafTwoRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    clearFrames();
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
    if (stripIntentRef.current !== null) {
      window.clearTimeout(stripIntentRef.current);
      stripIntentRef.current = null;
    }
  }, [clearFrames]);

  const revealTo = useCallback(
    (target: "strip" | "drawer") => {
      clearTimers();
      const seq = ++openSeqRef.current;
      const { sideDocks: latest, stripCount: count, visualState: currentState, phase: currentPhase, skipMotion: instant } = stateRef.current;
      const wasHandle = currentState === "handle";
      const alreadyOpenStrip = currentState === "strip" && currentPhase === "open" && target === "drawer";

      if (!wasHandle && currentState === target) {
        setPhase("open");
        if (target === "drawer") setDrawerPhase("open");
        return;
      }

      if (instant) {
        const { size, shape } = buildGeometryArgs(latest, target, count);
        void setSideDockGeometry(edge, size.width, size.height, latest[edge].along, shape).catch(() => undefined);
        setVisualState(target);
        setPhase("open");
        setDrawerPhase(target === "drawer" ? "open" : "idle");
        return;
      }

      if (alreadyOpenStrip) {
        setVisualState("drawer");
        setPhase("open");
        setDrawerPhase("preparing");
      } else {
        setVisualState(target);
        setPhase("preparing");
        setDrawerPhase(target === "drawer" ? "preparing" : "idle");
      }

      const { size, shape } = buildGeometryArgs(latest, target, count);
      void setSideDockGeometry(edge, size.width, size.height, latest[edge].along, shape)
        .catch(() => undefined)
        .finally(() => {
          if (openSeqRef.current !== seq) return;
          rafOneRef.current = window.requestAnimationFrame(() => {
            rafOneRef.current = null;
            rafTwoRef.current = window.requestAnimationFrame(() => {
              rafTwoRef.current = null;
              if (openSeqRef.current !== seq) return;
              setPhase("open");
              if (target === "drawer") setDrawerPhase("open");
            });
          });
        });
    },
    [clearTimers, edge],
  );

  const collapseToHandle = useCallback(() => {
    clearTimers();
    openSeqRef.current += 1;
    const current = stateRef.current;
    if (current.visualState === "handle") {
      setPhase("idle");
      setDrawerPhase("idle");
      return;
    }
    if (current.skipMotion) {
      setPhase("idle");
      setDrawerPhase("idle");
      setVisualState("handle");
      return;
    }
    setPhase("closing");
    if (current.visualState === "drawer") setDrawerPhase("closing");
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setPhase("idle");
      setDrawerPhase("idle");
      setVisualState("handle");
    }, MOTION_BASE_MS);
  }, [clearTimers]);

  const openOnTrigger = useCallback(() => {
    const { sideDocks: latest, stripCount: count } = stateRef.current;
    const target = targetVisualStateOnTrigger(latest, count);
    if (target === "handle") return;
    revealTo(target);
  }, [revealTo]);

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
      const { sideDocks: latest, visualState: vs, phase: currentPhase } = stateRef.current;
      if (inside) {
        if (leaveTimerRef.current !== null) {
          window.clearTimeout(leaveTimerRef.current);
          leaveTimerRef.current = null;
        }
        if (closeTimerRef.current !== null || currentPhase === "closing") {
          clearTimers();
          setPhase("open");
          if (vs === "drawer") setDrawerPhase("open");
          return;
        }
        if (vs === "handle" && latest.trigger === "hover") {
          clearTimers();
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
      if (stripIntentRef.current !== null) {
        window.clearTimeout(stripIntentRef.current);
        stripIntentRef.current = null;
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
    if (phase === "preparing" || phase === "closing") return;
    const { size, shape } = buildGeometryArgs(sideDocks, visualState, stripCount);
    void setSideDockGeometry(edge, size.width, size.height, sideConfig.along, shape).catch(() => undefined);
  }, [edge, phase, sideConfig.along, sideDocks, stripCount, visualState]);

  useEffect(() => {
    if ((sideConfig.pinned || previewHold) && visualState !== "drawer") {
      revealTo("drawer");
    }
  }, [previewHold, revealTo, sideConfig.pinned, visualState]);

  useEffect(() => {
    if (visualState === "strip" && (sideDocks.stages === 2 || stripCount === 0)) {
      revealTo("drawer");
    }
  }, [revealTo, sideDocks.stages, stripCount, visualState]);

  useEffect(() => {
    let cancelled = false;
    let disposeOpen: (() => void) | null = null;
    let disposeHover: (() => void) | null = null;
    let disposePreview: (() => void) | null = null;
    void listenSideDockOpenPage(edge, (pageId) => {
      setActivePage(pageId);
      revealTo("drawer");
    }).then((dispose) => {
      if (cancelled) dispose();
      else disposeOpen = dispose;
    });
    void listenSideDockHover(edge, handleHoverChange).then((dispose) => {
      if (cancelled) dispose();
      else disposeHover = dispose;
    });
    void listenSideDockPreview(edge, (open) => {
      setPreviewHold(open);
      if (open) revealTo("drawer");
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
  }, [collapseToHandle, edge, handleHoverChange, revealTo]);

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
      if (stripIntentRef.current !== null) {
        window.clearTimeout(stripIntentRef.current);
        stripIntentRef.current = null;
      }
      setActivePage(pageId);
      revealTo("drawer");
      if (sideConfig.lastPage !== pageId) {
        saveSideDocks({ ...sideDocks, [edge]: { ...sideConfig, lastPage: pageId } });
      }
    },
    [edge, revealTo, saveSideDocks, sideConfig, sideDocks],
  );

  const hoverStripPage = useCallback(
    (pageId: string) => {
      if (stateRef.current.sideDocks.autoDrawer !== "hover-item") return;
      if (stripIntentRef.current !== null) window.clearTimeout(stripIntentRef.current);
      stripIntentRef.current = window.setTimeout(() => {
        stripIntentRef.current = null;
        selectPage(pageId);
      }, STRIP_HOVER_INTENT_MS);
    },
    [selectPage],
  );

  const cancelStripHover = useCallback(() => {
    if (stripIntentRef.current !== null) {
      window.clearTimeout(stripIntentRef.current);
      stripIntentRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    setPreviewHold(false);
    if (sideConfig.pinned) {
      saveSideDocks({ ...sideDocks, [edge]: { ...sideConfig, pinned: false } });
    }
    collapseToHandle();
  }, [collapseToHandle, edge, saveSideDocks, sideConfig, sideDocks]);

  return {
    visualState,
    phase,
    drawerPhase,
    previewHold,
    activePage,
    handleHovered,
    openOnTrigger,
    selectPage,
    hoverStripPage,
    cancelStripHover,
    togglePin,
    dismiss,
    handleHoverChange,
    clearTimers,
  };
}
