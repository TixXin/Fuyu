import { useEffect, useMemo } from "react";
import { useTranslation } from "../../../i18n";
import { LINE_PRIORITY, type IslandContribution } from "../../plugin-kernel/islandContributions";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandAction, useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { togglePins } from "../api";
import { useIslandScreenshot } from "../useIslandScreenshot";
import { useRecording } from "../useRecording";
import { useScreenshotCard } from "../useScreenshotCard";
import { useScreenshotNotice } from "../useScreenshotNotice";
import { useScreenshotText } from "../useScreenshotText";
import { screenshotIsland } from "./islandState";
import { OWNER } from "./owner.ts";

type RunnerProps = {
  settings: { screenshotEnabled: boolean };
  collapseIsland: () => void;
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement);
}

function usePinsKey() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key.toLowerCase() !== "t" || event.ctrlKey || event.altKey || event.metaKey || isTyping(event.target)) return;
      void togglePins();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

function ScreenshotRunner({ settings, collapseIsland }: RunnerProps) {
  const t = useTranslation();
  const peek = useScreenshotText();
  const screenshot = useIslandScreenshot(settings.screenshotEnabled, collapseIsland);
  const card = useScreenshotCard(screenshot.settings.cardSeconds);
  const notice = useScreenshotNotice(card);
  const recording = useRecording();
  usePinsKey();
  useIslandAction("screenshot.start", screenshot.start);
  screenshotIsland.useProvide(useMemo(() => ({ recording, notice, peek }), [recording, notice, peek]));
  const list: IslandContribution[] = [];
  if (screenshot.start) list.push({ kind: "hint", key: "screenshot.start" });
  if (peek !== null) {
    list.push({ kind: "line", item: "screenshot.text", priority: LINE_PRIORITY.screenshotPeek, always: true, bare: true, drop: true, action: "translation.open-peek", label: t.translator.peekLabel(peek) });
    list.push({ kind: "reveal", reveal: "allowed", pauseIdle: true }, { kind: "busy" });
  }
  if (card.current !== null) list.push({ kind: "reveal", reveal: "always" }, { kind: "busy" });
  if (recording.shown) list.push({ kind: "busy" }, { kind: "notice", item: "recording" });
  if (notice.taken) list.push({ kind: "notice", item: "screenshot" });
  useIslandContributions(OWNER, "screenshot.island", list);
  return null;
}

runnerSlot.add({ id: "screenshot.runner", component: ScreenshotRunner }, OWNER);
