import { useCallback, useEffect, useRef, useState } from "react";
import { listenIslandHover } from "./api";
import { PREVIEW_LEAVE_MS } from "./hoverPreview";
import type { IslandMode } from "./types";

const OWN_ACTION_SELECTOR = ".island__collapsed button:not(.island__open-button):hover, .island:hover .island-taskbar-handle--armed";

type HoverPreviewOptions = {
  enabled: boolean;
  delayMs: number;
  autoExpandMs: number;
  paused: boolean;
  mode: IslandMode;
  isTucked: boolean;
  onExpand: () => void;
};

export function useHoverPreview({
  enabled,
  delayMs,
  autoExpandMs,
  paused,
  mode,
  isTucked,
  onExpand,
}: HoverPreviewOptions) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const hoveringRef = useRef(false);
  const armedRef = useRef(true);
  const openTimerRef = useRef<number | undefined>(undefined);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const autoTimerRef = useRef<number | undefined>(undefined);

  const closePreview = useCallback(() => {
    window.clearTimeout(openTimerRef.current);
    window.clearTimeout(closeTimerRef.current);
    window.clearTimeout(autoTimerRef.current);
    if (hoveringRef.current) armedRef.current = false;
    setPreviewOpen(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    void listenIslandHover((inside) => {
      hoveringRef.current = inside;
      if (!inside) armedRef.current = true;
      setIsHovering(inside);
    }).then((stop) => {
      if (cancelled) stop();
      else unlisten = stop;
    }).catch(() => {});
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".island-preview")) return;
      window.clearTimeout(openTimerRef.current);
      window.clearTimeout(autoTimerRef.current);
      armedRef.current = false;
      setPreviewOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey) {
        window.clearTimeout(openTimerRef.current);
        armedRef.current = false;
        setPreviewOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  useEffect(() => {
    if (!enabled || mode !== "collapsed" || isTucked || paused) {
      window.clearTimeout(openTimerRef.current);
      window.clearTimeout(closeTimerRef.current);
      window.clearTimeout(autoTimerRef.current);
      if (paused && hoveringRef.current) armedRef.current = false;
      setPreviewOpen(false);
    }
  }, [enabled, isTucked, mode, paused]);

  useEffect(() => {
    if (!enabled || !isHovering || mode !== "collapsed" || isTucked || paused || previewOpen || !armedRef.current) {
      return;
    }
    const open = () => {
      if (document.querySelector(OWN_ACTION_SELECTOR)) {
        openTimerRef.current = window.setTimeout(open, Math.max(delayMs, 100));
        return;
      }
      setPreviewOpen(true);
    };
    openTimerRef.current = window.setTimeout(open, delayMs);
    return () => window.clearTimeout(openTimerRef.current);
  }, [delayMs, enabled, isHovering, isTucked, mode, paused, previewOpen]);

  useEffect(() => {
    if (!previewOpen || isHovering) {
      window.clearTimeout(closeTimerRef.current);
      return;
    }
    closeTimerRef.current = window.setTimeout(() => {
      setPreviewOpen(false);
    }, PREVIEW_LEAVE_MS);
    return () => window.clearTimeout(closeTimerRef.current);
  }, [isHovering, previewOpen]);

  useEffect(() => {
    if (!previewOpen || autoExpandMs <= 0 || !isHovering) {
      window.clearTimeout(autoTimerRef.current);
      return;
    }
    autoTimerRef.current = window.setTimeout(() => {
      armedRef.current = false;
      setPreviewOpen(false);
      onExpand();
    }, autoExpandMs);
    return () => window.clearTimeout(autoTimerRef.current);
  }, [autoExpandMs, isHovering, onExpand, previewOpen]);

  return { previewOpen: enabled && mode === "collapsed" && !isTucked && !paused && previewOpen, closePreview };
}
