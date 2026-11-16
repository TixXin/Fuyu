import { useCallback, useEffect, useMemo, useRef } from "react";
import type { IslandContribution } from "../../plugin-kernel/islandContributions";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { matchesClipboardShortcut } from "../shortcut";
import { useClipboardCopyCard } from "../useClipboardCopyCard";
import { useClipboardHistory } from "../useClipboardHistory";
import { clipboardIsland } from "./islandState";
import { OWNER } from "./owner.ts";

type RunnerProps = {
  mode: string;
  page: string;
  quiet: boolean;
  openIslandPage: (page: "clipboard") => void;
  collapseIsland: () => void;
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function useToggle({ mode, page, openIslandPage, collapseIsland }: RunnerProps) {
  const toggledAt = useRef(0);
  return useCallback(() => {
    const now = Date.now();
    if (now - toggledAt.current < 250) return;
    toggledAt.current = now;
    if (mode === "expanded" && page === "clipboard") collapseIsland();
    else openIslandPage("clipboard");
  }, [collapseIsland, mode, openIslandPage, page]);
}

function useShortcutKey(enabled: boolean, shortcut: string, toggle: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!matchesClipboardShortcut(event, shortcut)) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, shortcut, toggle]);
}

function ClipboardRunner(props: RunnerProps) {
  const toggle = useToggle(props);
  const clipboard = useClipboardHistory(toggle);
  const copyCard = useClipboardCopyCard(!props.quiet);
  const { settings } = clipboard.clipboardHistory;
  useShortcutKey(settings.enabled && settings.shortcutEnabled, settings.shortcut, toggle);
  clipboardIsland.useProvide(useMemo(() => ({ clipboard, copyCard }), [clipboard, copyCard]));
  const list: IslandContribution[] = copyCard.current ? [{ kind: "notice", item: "copy" }] : [];
  useIslandContributions(OWNER, "clipboard.island", list);
  return null;
}

runnerSlot.add({ id: "clipboard.runner", component: ClipboardRunner }, OWNER);
