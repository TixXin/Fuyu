export type GameModeSettings = {
  gameDoNotDisturb: boolean;
  gameAutoTuck: boolean;
};

export type FullscreenState = { active: boolean; onIslandMonitor: boolean };

export type GameModeEffects = {
  quiet: boolean;
  tuck: boolean;
  passthrough: boolean;
};

export function gameModeEffects(fullscreen: FullscreenState, settings: GameModeSettings): GameModeEffects {
  const quiet = fullscreen.active && settings.gameDoNotDisturb;
  const tuck = fullscreen.active && fullscreen.onIslandMonitor && settings.gameAutoTuck;
  return { quiet, tuck, passthrough: quiet || tuck };
}
