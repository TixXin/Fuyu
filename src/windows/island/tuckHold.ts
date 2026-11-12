import type { IslandSettings } from "../../features/appearance/types";

export type TuckHoldState = {
  todoInProgress: boolean;
  agentWaiting: boolean;
  musicPlaying: boolean;
};

type HoldSettings = Pick<IslandSettings, "autoTuckHoldTodo" | "autoTuckHoldAgent" | "autoTuckHoldMusic" | "todoEnabled" | "agentStatusEnabled" | "musicEnabled">;

export function holdsTuck(settings: HoldSettings, state: TuckHoldState): boolean {
  return (settings.autoTuckHoldTodo && settings.todoEnabled && state.todoInProgress)
    || (settings.autoTuckHoldAgent && settings.agentStatusEnabled && state.agentWaiting)
    || (settings.autoTuckHoldMusic && settings.musicEnabled && state.musicPlaying);
}
