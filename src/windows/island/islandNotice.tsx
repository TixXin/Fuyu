import type { ReactNode } from "react";
import type { ClipboardCopyCardState } from "../../features/clipboard/useClipboardCopyCard";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { defineSlot, type IslandNoticeMeta } from "../../features/plugin-kernel/slots";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import type { RecordingNoticeState } from "../../features/screenshot/useRecording";
import type { ScreenshotNoticeState } from "../../features/screenshot/useScreenshotNotice";
import type { Timer } from "../../features/timer/timers";
import { useIslandReminder, type ShownReminder } from "../../features/timer/useIslandReminder";
import { openSettingsWindow } from "../settings/api";
import { FirstHintActions, FirstHintNotice } from "./first-hints/FirstHintNotice";
import type { FirstHintsController } from "./first-hints/useFirstHints";
import "./slots/builtins";

export type IslandNotice = { content: ReactNode; actions: ReactNode };

type NoticeSources = {
  recording: RecordingNoticeState;
  voice: IslandNotice | null;
  ringing: readonly Timer[];
  screenshotNotice: ScreenshotNoticeState;
  copyCard: ClipboardCopyCardState;
  firstHints: FirstHintsController;
};

type IslandNoticeSources = NoticeSources & { reminder: ShownReminder | null };

const noticeSlot = defineSlot<IslandNoticeSources, IslandNoticeMeta<IslandNoticeSources>>("island.notice/v1");

function FirstHintContent({ firstHints }: IslandNoticeSources) {
  return <FirstHintNotice key={firstHints.current} hints={firstHints} />;
}

function FirstHintButtons({ firstHints }: IslandNoticeSources) {
  return <FirstHintActions hints={firstHints} onConnectTools={() => openSettingsWindow("agentConnect")} />;
}

noticeSlot.add({ id: "first-hints", order: 70, active: ({ firstHints }) => Boolean(firstHints.current), component: FirstHintContent, actions: FirstHintButtons });

export function useIslandNotice(sources: NoticeSources): IslandNotice | null {
  const entries = useSlotEntries(noticeSlot);
  const all: IslandNoticeSources = { ...sources, reminder: useIslandReminder() };
  const entry = entries.find((item) => item.active(all));
  if (!entry) return null;
  return {
    content: <SlotView slot={noticeSlot} props={all} select={() => [entry]} />,
    actions: <SlotView slot={noticeSlot} props={all} select={() => [{ ...entry, component: entry.actions }]} />,
  };
}
