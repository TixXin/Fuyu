import { createRunnerStore } from "../../plugin-kernel/runnerStore";
import type { DelayNoticeState } from "../useDelayedScreenshot";
import type { RecordingNoticeState } from "../useRecording";
import type { ScreenshotNoticeState } from "../useScreenshotNotice";

export type ScreenshotIsland = {
  recording: RecordingNoticeState | null;
  delay: DelayNoticeState | null;
  notice: ScreenshotNoticeState | null;
  peek: string | null;
  openHistory: (() => void) | null;
  startDelayed: ((seconds: number) => void) | null;
};

export const screenshotIsland = createRunnerStore<ScreenshotIsland>({
  recording: null,
  delay: null,
  notice: null,
  peek: null,
  openHistory: null,
  startDelayed: null,
});
