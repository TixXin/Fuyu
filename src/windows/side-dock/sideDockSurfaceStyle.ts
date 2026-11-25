import type { CSSProperties } from "react";
import { hexToRgba } from "../../lib/settings/settings";
import {
  handleRadiusFor,
  innerRadiusFor,
  type SideDocksSettings,
} from "../../lib/settings/sideDocks";
import type { IslandSettings } from "../../lib/settings/types";
import { accentVariables, inkVariables, surfaceThemeColors } from "../../lib/theme/themeMode";
import { isLightIsland } from "../../utils/color";
import { stripWidthFor } from "./dockGeometry";

const CUSTOM_DARK_BG = "#0e0f16";
const CUSTOM_LIGHT_BG = "#f5f7fc";
const CUSTOM_SOLID_DARK_BG = "#12131a";

export type SideDockSurface = {
  isLight: boolean;
  isGlass: boolean;
  backgroundHex: string;
  glassSettings: IslandSettings;
  style: CSSProperties;
};

export function computeSideDockSurface(
  settings: IslandSettings,
  sideDocks: SideDocksSettings,
  accent: string | null,
): SideDockSurface {
  const panelLook = surfaceThemeColors(settings, "panel");
  const followMain = sideDocks.appearance === "follow";
  const isLight = followMain ? isLightIsland(panelLook.islandBackgroundColor) : sideDocks.theme === "light";
  const isGlass = followMain ? settings.appearanceMode === "liquidGlass" : sideDocks.material === "glass";
  const backgroundHex = followMain
    ? panelLook.islandBackgroundColor
    : isLight
      ? CUSTOM_LIGHT_BG
      : isGlass
        ? CUSTOM_DARK_BG
        : CUSTOM_SOLID_DARK_BG;
  const opacityPct = followMain ? settings.opacity : isGlass ? sideDocks.surfaceOpacity : 98;
  const surfaceFill = hexToRgba(backgroundHex, opacityPct / 100);
  const glassStrength = (followMain ? settings.glassIntensity : 68) / 100;
  const panelBlurPx = Math.round(14 + glassStrength * 14);
  const glassBackdrop = settings.glassBackdrop === "native" ? "wallpaper" : settings.glassBackdrop;
  const glassSettings: IslandSettings = {
    ...settings,
    appearanceMode: isGlass ? "liquidGlass" : "classic",
    glassBackdrop,
    opacity: opacityPct,
    islandBackgroundColor: backgroundHex,
  };

  const style = {
    ...(followMain ? inkVariables(panelLook) : {}),
    ...accentVariables(accent),
    "--island-background-color": backgroundHex,
    "--island-fill": surfaceFill,
    "--island-corner-shape": settings.islandCornerShape,
    "--glass-intensity": glassStrength,
    "--glass-mask-opacity": opacityPct / 100,
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
    "--glass-panel-blur": `${panelBlurPx}px`,
    "--glass-tint-color": surfaceFill,
    "--glass-collapsed-tint-color": surfaceFill,
    "--glass-page-accent": accent ?? "var(--color-accent)",
    "--glass-pointer-x": "0.5",
    "--glass-pointer-y": "0.18",
    "--side-surface-fill": surfaceFill,
    "--side-panel-blur": `${panelBlurPx}px`,
    "--side-outer-r": `${sideDocks.outerRadius}px`,
    "--side-inner-r": `${innerRadiusFor(sideDocks.outerRadius)}px`,
    "--side-handle-r": `${handleRadiusFor(sideDocks.outerRadius)}px`,
    "--side-handle-w": `${sideDocks.handleWidth}px`,
    "--side-handle-h": `${sideDocks.handleHeight}px`,
    "--side-handle-alpha": String(sideDocks.handleOpacity / 100),
    "--side-strip-w": `${stripWidthFor(sideDocks)}px`,
    "--side-gap": `${sideDocks.gap}px`,
    "--side-drawer-w": `${sideDocks.drawerWidth}px`,
    "--side-drawer-h": `${sideDocks.drawerHeight}px`,
  } as CSSProperties;

  return { isLight, isGlass, backgroundHex, glassSettings, style };
}
