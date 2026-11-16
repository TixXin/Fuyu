import type { ReactNode } from "react";
import { ClipboardCopyNotice, ClipboardCopyNoticeActions } from "../../features/clipboard/ClipboardCopyNotice";
import type { ClipboardCopyCardState } from "../../features/clipboard/useClipboardCopyCard";
import { FirstHintActions, FirstHintNotice } from "./first-hints/FirstHintNotice";
import type { FirstHintsController } from "./first-hints/useFirstHints";
import { RecordingNotice, RecordingNoticeActions } from "../../features/screenshot/RecordingNotice";
import { ScreenshotNotice, ScreenshotNoticeActions } from "../../features/screenshot/ScreenshotNotice";
import type { RecordingNoticeState } from "../../features/screenshot/useRecording";
import type { ScreenshotNoticeState } from "../../features/screenshot/useScreenshotNotice";
import { ReminderNotice, ReminderNoticeActions } from "../../features/timer/ReminderNotice";
import { TimerNotice, TimerNoticeActions } from "../../features/timer/TimerNotice";
import type { Timer } from "../../features/timer/timers";
import { useBreakReminders } from "../../features/timer/useBreakReminders";
import { useIslandReminder, type ShownReminder } from "../../features/timer/useIslandReminder";
import { openSettingsWindow } from "../settings/api";

export type IslandNotice = { content: ReactNode; actions: ReactNode };

type NoticeSources = {
  recording: RecordingNoticeState;
  voice: IslandNotice | null;
  ringing: readonly Timer[];
  screenshotNotice: ScreenshotNoticeState;
  copyCard: ClipboardCopyCardState;
  firstHints: FirstHintsController;
};

export function useIslandNotice(sources: NoticeSources): IslandNotice | null {
  useBreakReminders();
  return pickIslandNotice({ ...sources, reminder: useIslandReminder() });
}

function pickIslandNotice({ recording, voice, ringing, screenshotNotice, copyCard, reminder, firstHints }: NoticeSources & {
  reminder: ShownReminder | null;
}): IslandNotice | null {
  return recording.shown
    ? { content: <RecordingNotice recording={recording} />, actions: <RecordingNoticeActions recording={recording} /> }
    : voice
    ? voice
    : ringing.length > 0
    ? { content: <TimerNotice ringing={ringing} />, actions: <TimerNoticeActions /> }
    : screenshotNotice.taken
    ? { content: <ScreenshotNotice key={screenshotNotice.taken.path} notice={screenshotNotice} />, actions: <ScreenshotNoticeActions notice={screenshotNotice} /> }
    : copyCard.current
    ? { content: <ClipboardCopyNotice key={copyCard.current.key} card={copyCard} />, actions: <ClipboardCopyNoticeActions card={copyCard} /> }
    : reminder
    ? { content: <ReminderNotice key={reminder.current.id} reminder={reminder} />, actions: <ReminderNoticeActions reminder={reminder} /> }
    : firstHints.current
      ? { content: <FirstHintNotice key={firstHints.current} hints={firstHints} />, actions: <FirstHintActions hints={firstHints} onConnectTools={() => openSettingsWindow("agentConnect")} /> }
      : null;
}
