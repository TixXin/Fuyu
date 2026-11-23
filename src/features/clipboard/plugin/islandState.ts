import { createRunnerStore } from "../../plugin-kernel/runnerStore";
import type { ClipboardCopyCardState } from "../useClipboardCopyCard";
import type { useClipboardHistory } from "../useClipboardHistory";

export type ClipboardIsland = {
  clipboard: ReturnType<typeof useClipboardHistory>;
  copyCard: ClipboardCopyCardState;
  openPage: () => void;
};

export const clipboardIsland = createRunnerStore<ClipboardIsland | null>(null);
