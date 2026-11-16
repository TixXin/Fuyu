import type { ReactNode } from "react";
import type { ClipboardCopyCardState } from "../../features/clipboard/useClipboardCopyCard";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { defineSlot, type IslandNoticeMeta } from "../../features/plugin-kernel/slots";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import type { RecordingNoticeState } from "../../features/screenshot/useRecording";
import type { ScreenshotNoticeState } from "../../features/screenshot/useScreenshotNotice";
import { useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import { openSettingsWindow } from "../settings/api";
import { FirstHintActions, FirstHintNotice } from "./first-hints/FirstHintNotice";
import type { FirstHintsController } from "./first-hints/useFirstHints";
import "./slots/builtins";

export type IslandNotice = { content: ReactNode; actions: ReactNode };

type NoticeSources = {
  recording: RecordingNoticeState;
  screenshotNotice: ScreenshotNoticeState;
  copyCard: ClipboardCopyCardState;
  firstHints: FirstHintsController;
};

const noticeSlot = defineSlot<NoticeSources, IslandNoticeMeta<NoticeSources>>("island.notice/v1");

function FirstHintContent({ firstHints }: NoticeSources) {
  return <FirstHintNotice key={firstHints.current} hints={firstHints} />;
}

function FirstHintButtons({ firstHints }: NoticeSources) {
  return <FirstHintActions hints={firstHints} onConnectTools={() => openSettingsWindow("agentConnect")} />;
}

noticeSlot.add({ id: "first-hints", order: 70, active: ({ firstHints }) => Boolean(firstHints.current), component: FirstHintContent, actions: FirstHintButtons });

export function useIslandNotice(sources: NoticeSources): IslandNotice | null {
  const entries = useSlotEntries(noticeSlot);
  const { notices } = useIslandContributed();
  const entry = entries.find((item) => notices.has(item.id) || item.active?.(sources));
  if (!entry) return null;
  return {
    content: <SlotView slot={noticeSlot} props={sources} select={() => [entry]} />,
    actions: <SlotView slot={noticeSlot} props={sources} select={() => [{ ...entry, component: entry.actions }]} />,
  };
}
