import type { ReactNode } from "react";
import { ClipboardCopyNotice, ClipboardCopyNoticeActions } from "../../features/clipboard/ClipboardCopyNotice";
import type { ClipboardCopyCardState } from "../../features/clipboard/useClipboardCopyCard";
import { FirstHintActions, FirstHintNotice } from "../../features/first-hints/FirstHintNotice";
import type { FirstHintsController } from "../../features/first-hints/useFirstHints";
import { RecordingNotice, RecordingNoticeActions } from "../../features/screenshot/RecordingNotice";
import { ScreenshotNotice, ScreenshotNoticeActions } from "../../features/screenshot/ScreenshotNotice";
import type { RecordingNoticeState } from "../../features/screenshot/useRecording";
import type { ScreenshotNoticeState } from "../../features/screenshot/useScreenshotNotice";
import { TimerNotice, TimerNoticeActions } from "../../features/timer/TimerNotice";
import type { Timer } from "../../features/timer/timers";
import { openSettingsWindow } from "../settings/api";

export type IslandNotice = { content: ReactNode; actions: ReactNode };

export function pickIslandNotice({ recording, ringing, screenshotNotice, copyCard, firstHints }: {
  recording: RecordingNoticeState;
  ringing: readonly Timer[];
  screenshotNotice: ScreenshotNoticeState;
  copyCard: ClipboardCopyCardState;
  firstHints: FirstHintsController;
}): IslandNotice | null {
  return recording.shown
    ? { content: <RecordingNotice recording={recording} />, actions: <RecordingNoticeActions recording={recording} /> }
    : ringing.length > 0
    ? { content: <TimerNotice ringing={ringing} />, actions: <TimerNoticeActions /> }
    : screenshotNotice.taken
    ? { content: <ScreenshotNotice key={screenshotNotice.taken.path} notice={screenshotNotice} />, actions: <ScreenshotNoticeActions notice={screenshotNotice} /> }
    : copyCard.current
    ? { content: <ClipboardCopyNotice key={copyCard.current.key} card={copyCard} />, actions: <ClipboardCopyNoticeActions card={copyCard} /> }
    : firstHints.current
      ? { content: <FirstHintNotice key={firstHints.current} hints={firstHints} />, actions: <FirstHintActions hints={firstHints} onConnectTools={() => openSettingsWindow("agentConnect")} /> }
      : null;
}
