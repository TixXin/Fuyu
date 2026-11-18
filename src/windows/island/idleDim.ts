import { clamp } from "../../utils/number.ts";
import {
  MAX_IDLE_DIM_OPACITY,
  MAX_ISLAND_OPACITY,
  MIN_IDLE_DIM_OPACITY,
  MIN_ISLAND_OPACITY,
} from "../../lib/settings/settingsLimits.ts";
import type { IslandSettings } from "../../lib/settings/types";
import type { IslandMode } from "./types";

export type IdleDimBlockers = {
  mode: IslandMode;
  isTucked: boolean;
  resizing: boolean;
  dragging: boolean;
  demoActive: boolean;
  hasPrompt: boolean;
  hasNotice: boolean;
  hasPreview: boolean;
  hasAlert: boolean;
  hasBanner: boolean;
  hasOpenPopup: boolean;
  hasReveal: boolean;
  hasAgentInterjection: boolean;
  hidden: boolean;
};

export function canIdleDim(enabled: boolean, blockers: IdleDimBlockers): boolean {
  return (
    enabled &&
    blockers.mode === "collapsed" &&
    !blockers.isTucked &&
    !blockers.resizing &&
    !blockers.dragging &&
    !blockers.demoActive &&
    !blockers.hasPrompt &&
    !blockers.hasNotice &&
    !blockers.hasPreview &&
    !blockers.hasAlert &&
    !blockers.hasBanner &&
    !blockers.hasOpenPopup &&
    !blockers.hasReveal &&
    !blockers.hasAgentInterjection &&
    !blockers.hidden
  );
}

export function effectiveIslandOpacity(
  settings: Pick<IslandSettings, "islandOpacity" | "idleDim" | "idleDimOpacity">,
  state: { mode: IslandMode; isTucked: boolean; isDimmed: boolean },
): number {
  const normal = clamp(settings.islandOpacity, MIN_ISLAND_OPACITY, MAX_ISLAND_OPACITY) / 100;
  if (state.isDimmed && settings.idleDim && state.mode === "collapsed" && !state.isTucked) {
    const dimmed = clamp(settings.idleDimOpacity, MIN_IDLE_DIM_OPACITY, MAX_IDLE_DIM_OPACITY) / 100;
    return Math.min(normal, dimmed);
  }
  return normal;
}
