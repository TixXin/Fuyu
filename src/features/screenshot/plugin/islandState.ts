import { createRunnerStore } from "../../plugin-kernel/runnerStore";
import type { RecordingNoticeState } from "../useRecording";
import type { ScreenshotNoticeState } from "../useScreenshotNotice";

export type ScreenshotIsland = {
  recording: RecordingNoticeState | null;
  notice: ScreenshotNoticeState | null;
  peek: string | null;
  openHistory: (() => void) | null;
};

export const screenshotIsland = createRunnerStore<ScreenshotIsland>({ recording: null, notice: null, peek: null, openHistory: null });
