import type { ReactNode } from "react";
import { createRunnerStore } from "../../plugin-kernel/runnerStore";

export type VoiceNotice = { content: ReactNode; actions: ReactNode };

export const voiceNotice = createRunnerStore<VoiceNotice | null>(null);
