import { useEffect, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  hasActiveIslandBanner,
  listenIslandDimWake,
  listenIslandHover,
  listenIslandMoveArmed,
  listenIslandPositionChanged,
  listenIslandRevealRequested,
  subscribeIslandBannerPresence,
} from "./api";
import { canIdleDim } from "./idleDim";
import type { IslandMode } from "./types";

export type UseIdleDimOptions = {
  enabled: boolean;
  seconds: number;
  mode: IslandMode;
  isTucked: boolean;
  resizing?: boolean;
  demoActive?: boolean;
  hasPrompt?: boolean;
  hasNotice?: boolean;
  hasPreview?: boolean;
  hasAlert?: boolean;
  hasOpenPopup?: boolean;
  hasReveal?: boolean;
  hasAgentInterjection?: boolean;
  agentWaiting?: boolean;
};

function attachUnlisten(promise: Promise<UnlistenFn>, bucket: (() => void)[], cancelled: { current: boolean }) {
  void promise
    .then((unlisten) => {
      if (cancelled.current) unlisten();
      else bucket.push(unlisten);
    })
    .catch(() => {});
}

export function useIdleDim({
  enabled,
  seconds,
  mode,
  isTucked,
  resizing = false,
  demoActive = false,
  hasPrompt = false,
  hasNotice = false,
  hasPreview = false,
  hasAlert = false,
  hasOpenPopup = false,
  hasReveal = false,
  hasAgentInterjection = false,
  agentWaiting = false,
}: UseIdleDimOptions): boolean {
  const [isDimmed, setIsDimmed] = useState(false);
  const [hasBanner, setHasBanner] = useState(() => hasActiveIslandBanner());
  const [hidden, setHidden] = useState(() => document.hidden);

  useEffect(() => subscribeIslandBannerPresence(setHasBanner), []);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const eligible = canIdleDim(enabled, {
    mode,
    isTucked,
    resizing,
    dragging: false,
    demoActive,
    hasPrompt,
    hasNotice,
    hasPreview,
    hasAlert,
    hasBanner,
    hasOpenPopup,
    hasReveal,
    hasAgentInterjection,
    hidden,
  });

  useEffect(() => {
    if (!eligible) {
      setIsDimmed(false);
      return;
    }
    setIsDimmed(false);
    let timer: number | undefined;
    let pointerDown = false;
    let composing = false;
    const cancelled = { current: false };
    const unlistens: (() => void)[] = [];

    const restart = () => {
      window.clearTimeout(timer);
      setIsDimmed(false);
      if (!pointerDown && !composing && !document.hidden) {
        timer = window.setTimeout(() => setIsDimmed(true), seconds * 1_000);
      }
    };
    const startPointer = () => {
      pointerDown = true;
      restart();
    };
    const endPointer = () => {
      pointerDown = false;
      restart();
    };
    const startComposition = () => {
      composing = true;
      restart();
    };
    const endComposition = () => {
      composing = false;
      restart();
    };
    const blur = () => {
      pointerDown = false;
      composing = false;
      restart();
    };

    const events = ["pointermove", "keydown", "wheel", "input", "focusin", "focus"];
    events.forEach((event) => window.addEventListener(event, restart, true));
    window.addEventListener("pointerdown", startPointer, true);
    window.addEventListener("pointerup", endPointer, true);
    window.addEventListener("pointercancel", endPointer, true);
    window.addEventListener("compositionstart", startComposition, true);
    window.addEventListener("compositionend", endComposition, true);
    window.addEventListener("blur", blur);

    attachUnlisten(listenIslandDimWake(restart), unlistens, cancelled);
    attachUnlisten(listenIslandRevealRequested(restart), unlistens, cancelled);
    attachUnlisten(
      listenIslandHover((inside) => {
        if (inside) restart();
      }),
      unlistens,
      cancelled,
    );
    attachUnlisten(
      listenIslandMoveArmed((target) => {
        if (target !== "none") restart();
      }),
      unlistens,
      cancelled,
    );
    attachUnlisten(
      listenIslandPositionChanged(() => {
        pointerDown = false;
        restart();
      }),
      unlistens,
      cancelled,
    );

    restart();
    return () => {
      cancelled.current = true;
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, restart, true));
      window.removeEventListener("pointerdown", startPointer, true);
      window.removeEventListener("pointerup", endPointer, true);
      window.removeEventListener("pointercancel", endPointer, true);
      window.removeEventListener("compositionstart", startComposition, true);
      window.removeEventListener("compositionend", endComposition, true);
      window.removeEventListener("blur", blur);
      unlistens.forEach((unlisten) => unlisten());
    };
  }, [eligible, seconds, agentWaiting]);

  return eligible && isDimmed;
}
