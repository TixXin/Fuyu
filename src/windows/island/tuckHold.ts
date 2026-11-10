import type { IslandSettings } from "../../features/appearance/types";

/** What is on now that may keep the island out (issue #29). */
export type TuckHoldState = {
  /** A todo was started and shows on the island. */
  todoInProgress: boolean;
  /** An agent session waits for the user's approval or answer. */
  agentWaiting: boolean;
  /** Music plays. */
  musicPlaying: boolean;
};

type HoldSettings = Pick<IslandSettings, "autoTuckHoldTodo" | "autoTuckHoldAgent" | "autoTuckHoldMusic" | "todoEnabled" | "agentStatusEnabled" | "musicEnabled">;

/**
 * Whether the idle timer should leave the island out now: something it was asked to stay out
 * for is on, and that feature is switched on. When none is, the timer starts again in full.
 */
export function holdsTuck(settings: HoldSettings, state: TuckHoldState): boolean {
  return (settings.autoTuckHoldTodo && settings.todoEnabled && state.todoInProgress)
    || (settings.autoTuckHoldAgent && settings.agentStatusEnabled && state.agentWaiting)
    || (settings.autoTuckHoldMusic && settings.musicEnabled && state.musicPlaying);
}
