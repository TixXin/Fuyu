export type GameModeSettings = {
  gameDoNotDisturb: boolean;
  gameAutoTuck: boolean;
};

export type FullscreenState = { active: boolean; onIslandMonitor: boolean };

export type GameModeEffects = {
  quiet: boolean;
  tuck: boolean;
};

export function gameModeEffects(fullscreen: FullscreenState, settings: GameModeSettings): GameModeEffects {
  return {
    quiet: fullscreen.active && settings.gameDoNotDisturb,
    tuck: fullscreen.active && fullscreen.onIslandMonitor && settings.gameAutoTuck,
  };
}
