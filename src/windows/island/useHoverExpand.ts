import { useEffect, useRef, useState } from "react";
import { isIslandHeld } from "./islandHold";
import { listenIslandHover, listenIslandMoveArmed } from "./api";
import type { IslandMode } from "./types";

const OWN_ACTION_SELECTOR = ".island__collapsed button:not(.island__open-button):hover";

type HoverExpandOptions = {
  enabled: boolean;
  delayMs: number;
  paused: boolean;
  collapseDelayMs: number;
  mode: IslandMode;
  isTucked: boolean;
  onExpand: () => void;
  onCollapse: () => void;
};

export function isEditingText() {
  const element = document.activeElement;
  return (
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLInputElement && !["button", "checkbox", "radio", "range", "submit"].includes(element.type)) ||
    (element instanceof HTMLElement && element.isContentEditable)
  );
}

export function useHoverExpand({ enabled, delayMs, paused, collapseDelayMs, mode, isTucked, onExpand, onCollapse }: HoverExpandOptions) {
  const [isHovering, setIsHovering] = useState(false);
  const isHoveringRef = useRef(false);
  const modeRef = useRef(mode);
  const armedRef = useRef(true);
  const enteredRef = useRef(false);
  const pressingRef = useRef(false);
  const expandTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let didCancel = false;
    let unlisten: (() => void) | null = null;

    void listenIslandHover((inside) => {
      isHoveringRef.current = inside;
      if (inside && modeRef.current === "expanded") enteredRef.current = true;
      if (!inside) armedRef.current = true;
      setIsHovering(inside);
    })
      .then((nextUnlisten) => {
        if (didCancel) nextUnlisten();
        else unlisten = nextUnlisten;
      })
      .catch((error) => {
        console.error("Failed to listen for island hover", error);
      });

    return () => {
      didCancel = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const press = () => {
      window.clearTimeout(expandTimerRef.current);
      armedRef.current = false;
      pressingRef.current = true;
    };
    const release = () => {
      pressingRef.current = false;
    };

    window.addEventListener("pointerdown", press, true);
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointerdown", press, true);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
      window.removeEventListener("blur", release);
    };
  }, []);

  useEffect(() => {
    let didCancel = false;
    let unlisten: (() => void) | null = null;
    void listenIslandMoveArmed((target) => {
      if (target === "none" || modeRef.current !== "collapsed") return;
      window.clearTimeout(expandTimerRef.current);
      armedRef.current = false;
    })
      .then((nextUnlisten) => {
        if (didCancel) nextUnlisten();
        else unlisten = nextUnlisten;
      })
      .catch((error) => console.error("Failed to listen for the island move modifier", error));
    return () => {
      didCancel = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    modeRef.current = mode;
    if (mode === "collapsed") {
      enteredRef.current = false;
      if (isHoveringRef.current) armedRef.current = false;
    } else if (isHoveringRef.current) {
      enteredRef.current = true;
    }
  }, [mode]);

  const wasTuckedRef = useRef(isTucked);
  useEffect(() => {
    if (wasTuckedRef.current && !isTucked && (isHoveringRef.current || document.querySelector(".island:hover"))) {
      armedRef.current = false;
    }
    wasTuckedRef.current = isTucked;
  }, [isTucked]);

  useEffect(() => {
    if (!enabled || !isHovering || mode !== "collapsed" || isTucked || !armedRef.current) {
      return;
    }
    if (paused) {
      armedRef.current = false;
      return;
    }

    const open = () => {
      if (document.querySelector(OWN_ACTION_SELECTOR)) {
        expandTimerRef.current = window.setTimeout(open, Math.max(delayMs, 100));
        return;
      }
      armedRef.current = false;
      onExpand();
    };

    expandTimerRef.current = window.setTimeout(open, delayMs);
    return () => window.clearTimeout(expandTimerRef.current);
  }, [delayMs, enabled, isHovering, isTucked, mode, onExpand, paused]);

  useEffect(() => {
    if (!enabled || isHovering || mode !== "expanded" || !enteredRef.current) {
      return;
    }

    let timer: number | undefined;
    const close = () => {
      if (pressingRef.current || isEditingText() || isIslandHeld()) {
        timer = window.setTimeout(close, Math.max(collapseDelayMs, 200));
        return;
      }
      onCollapse();
    };

    timer = window.setTimeout(close, collapseDelayMs);
    return () => window.clearTimeout(timer);
  }, [collapseDelayMs, enabled, isHovering, mode, onCollapse]);
}
