import { createRunnerStore } from "../../plugin-kernel/runnerStore";

export const translationPeekState = createRunnerStore<string | null>(null);
