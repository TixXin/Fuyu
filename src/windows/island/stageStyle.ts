import type { CSSProperties } from "react";
import { hexToRgba } from "../../features/appearance/settings";
import type { IslandSettings } from "../../features/appearance/types";
import { inkOn } from "../../utils/color";
import { accentVariables } from "../../features/appearance/themeMode";
import type { IslandMode } from "./types";

export function getIslandStageStyle(
  settings: IslandSettings,
  mode: IslandMode,
  collapsedIslandWidth: number,
  expandedIslandHeight: number,
  expandedIslandWidth: number,
  accent: string | null = null,
  devicePixelRatio = window.devicePixelRatio,
) {
  const glassStrength = settings.glassIntensity / 100;
  const glassMaskOpacity = settings.opacity / 100;

  return ({
    "--island-fill": hexToRgba(settings.islandBackgroundColor, settings.opacity / 100),
    "--island-scale": mode === "collapsed" ? settings.collapsedScale : settings.expandedScale,
    "--island-collapsed-scale": settings.collapsedScale,
    "--island-expanded-scale": settings.expandedScale,
    "--collapsed-island-width": `${collapsedIslandWidth}px`,
    "--expanded-island-height": `${expandedIslandHeight}px`,
    "--expanded-island-width": `${expandedIslandWidth}px`,
    "--island-top-fillet-size": settings.topFilletRadius,
    "--island-device-pixel": `${1 / devicePixelRatio}px`,
    "--island-pixel-nudge": Number.isInteger(devicePixelRatio) ? "0px" : "0.001px",
    "--island-corner-radius-size": settings.islandCornerRadius,
    "--island-corner-shape": settings.islandCornerShape,
    "--task-text-color": settings.taskTextColor,
    "--island-pulse-color": settings.pulseColor,
    "--island-pulse-glow-color": hexToRgba(settings.pulseColor, 0.72),
    ...accentVariables(accent),
    "--island-pulse-brightness": `${settings.pulseBrightness}%`,
    "--island-background-color": settings.islandBackgroundColor,
    "--island-ink-rgb": inkOn(settings.islandBackgroundColor),
    "--glass-intensity": glassStrength,
    "--glass-mask-opacity": glassMaskOpacity,
    "--glass-soft-alpha": 0.045 + glassStrength * 0.045,
    "--glass-shadow-alpha": 0.14 + glassStrength * 0.1,
    "--glass-inset-alpha": 0.2 + glassStrength * 0.2,
    "--glass-cyan-alpha": glassStrength * 0.16,
    "--glass-magenta-alpha": glassStrength * 0.1,
    "--glass-glow-alpha": 0.16 + glassStrength * 0.14,
    "--glass-accent-alpha": glassStrength * 0.055,
    "--glass-refraction-opacity": 0.45 + glassStrength * 0.38,
    "--glass-border-alpha": 0.1 + glassStrength * 0.18,
    "--glass-inner-accent-alpha": glassStrength * 0.08,
    "--glass-highlight-opacity": 0.34 + glassStrength * 0.38,
    "--glass-panel-accent-alpha": glassStrength * 0.085,
    "--glass-panel-blur": `${10 + glassStrength * 9}px`,
    "--glass-tint-color": hexToRgba(
      settings.islandBackgroundColor,
      glassMaskOpacity,
    ),
    "--glass-collapsed-tint-color": hexToRgba(
      settings.islandBackgroundColor,
      glassMaskOpacity,
    ),
  }) as CSSProperties;
}
