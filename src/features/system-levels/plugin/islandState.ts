import { createRunnerStore } from "../../plugin-kernel/runnerStore";
import type { LevelChange } from "../api";

export const levelState = createRunnerStore<LevelChange | null>(null);
