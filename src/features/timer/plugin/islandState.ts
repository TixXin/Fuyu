import { createRunnerStore } from "../../plugin-kernel/runnerStore";
import type { Timer } from "../timers";
import type { ShownReminder } from "../useIslandReminder";

export type TimerIslandState = { ringing: readonly Timer[]; reminder: ShownReminder | null };

export const timerIsland = createRunnerStore<TimerIslandState>({ ringing: [], reminder: null });

export const TIMER_CHIP_HINT = "timer.chip";
