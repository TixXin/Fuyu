import { useMemo, type CSSProperties } from "react";
import type { IslandSettings } from "../../lib/settings/types";
import { surfaceThemeColors } from "../../lib/theme/themeMode";
import { isLightIsland } from "../../utils/color";
import { getIslandStageStyle } from "./stageStyle";
import type { IslandMode } from "./types";
import type { IslandOnTaskbar } from "./useIslandOnTaskbar";

type TaskbarPartsInput = {
  onTaskbar: IslandOnTaskbar;
  settings: IslandSettings;
  look: IslandSettings;
  mode: IslandMode;
  docked: boolean;
  accent: string | null;
  devicePixelRatio: number;
  collapsedIslandWidth: number;
  expandedIslandHeight: number;
  expandedIslandWidth: number;
};

export type TaskbarParts = {
  panelled: boolean;
  shift: number;
  taskbarClear: boolean;
  lightStage: boolean;
  barStyle: CSSProperties;
  barLight: boolean;
  panelLight: boolean;
};

export function panelShift(width: number, roomLeft: number, roomRight: number): number {
  const half = width / 2;
  if (width >= roomLeft + roomRight) return (roomRight - roomLeft) / 2;
  if (half > roomLeft) return half - roomLeft;
  if (half > roomRight) return roomRight - half;
  return 0;
}

export function useTaskbarParts({
  onTaskbar,
  settings,
  look,
  mode,
  docked,
  accent,
  devicePixelRatio,
  collapsedIslandWidth,
  expandedIslandHeight,
  expandedIslandWidth,
}: TaskbarPartsInput): TaskbarParts {
  const panelled = onTaskbar.placed && onTaskbar.lift > 0 && docked;
  const clear = onTaskbar.placed && settings.taskbarLook === "transparent";
  const taskbarClear = clear && (panelled || mode === "collapsed");
  const barLook = useMemo(() => (panelled ? surfaceThemeColors(settings, "collapsed") : null), [panelled, settings]);
  const barStyle = useMemo(
    () => (barLook ? getIslandStageStyle(barLook, "collapsed", collapsedIslandWidth, expandedIslandHeight, expandedIslandWidth, accent, devicePixelRatio) : {}),
    [barLook, collapsedIslandWidth, expandedIslandHeight, expandedIslandWidth, accent, devicePixelRatio],
  );
  const panelLight = isLightIsland(look.islandBackgroundColor);
  const shift = panelled ? Math.round(panelShift(expandedIslandWidth * settings.expandedScale, onTaskbar.roomLeft, onTaskbar.roomRight)) : 0;
  if (!barLook) {
    return { panelled, shift, taskbarClear, lightStage: taskbarClear ? onTaskbar.light : panelLight, barStyle, barLight: false, panelLight };
  }
  const barLight = clear ? onTaskbar.light : isLightIsland(barLook.islandBackgroundColor);
  return { panelled, shift, taskbarClear, lightStage: false, barStyle, barLight, panelLight };
}
