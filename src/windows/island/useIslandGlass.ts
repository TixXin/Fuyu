import { useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { glassClassNames, glassPalette, glassPaused, glassVariables, type GlassPalette } from "../../lib/theme/glassPalette";
import { isLightIsland } from "../../utils/color";
import type { IslandSettings } from "../../lib/settings/types";
import { usePageHidden } from "../../lib/usePageHidden";
import type { IslandMode } from "./types";
import { INITIAL_GLASS_LAYER, sameGlassLayer, type GlassBackdropChoice, type GlassLayerState } from "./glassStatus";

export type IslandGlassView = {
  className: string;
  palette: GlassPalette;
  shader: boolean;
  specular: boolean;
  paused: boolean;
  strength: number;
  choice: GlassBackdropChoice;
  blur: number;
  saturation: number;
  contrastGuard: boolean;
  light: boolean;
  onLayerState?: (state: GlassLayerState) => void;
};

export function useIslandGlass({
  settings,
  background,
  accent,
  cover,
  mode,
  isTucked,
  quiet,
  reducedMotion,
}: {
  settings: IslandSettings;
  background: string;
  accent: string | null;
  cover: string | null;
  mode: IslandMode;
  isTucked: boolean;
  quiet: boolean;
  reducedMotion: boolean;
}) {
  const hidden = usePageHidden();
  const [layerState, setLayerState] = useState<GlassLayerState>(INITIAL_GLASS_LAYER);
  const onLayerState = useCallback(
    (next: GlassLayerState) => setLayerState((current) => (sameGlassLayer(current, next) ? current : next)),
    [],
  );
  const { glassColorSource, glassColor1, glassColor2, glassColor3, glassBackdrop } = settings;
  const glassContrastGuard = settings.glassContrastGuard && glassBackdrop === "none";
  const palette = useMemo(
    () => glassPalette({
      settings: { glassColorSource, glassColor1, glassColor2, glassColor3, glassContrastGuard },
      accent,
      cover,
      background,
    }),
    [glassColorSource, glassColor1, glassColor2, glassColor3, glassContrastGuard, accent, cover, background],
  );
  const { glassColorStrength, glassFlowSpeed, glassBlobScale, glassRimWidth, glassBlur, glassSaturation, glassNoise } = settings;
  const glassStyle = useMemo(
    () => glassVariables({ glassColorStrength, glassFlowSpeed, glassBlobScale, glassRimWidth, glassBlur, glassSaturation, glassNoise }, palette) as CSSProperties,
    [glassColorStrength, glassFlowSpeed, glassBlobScale, glassRimWidth, glassBlur, glassSaturation, glassNoise, palette],
  );
  const paused = glassPaused(settings, { mode, isTucked, quiet, hidden, reducedMotion });
  const glass: IslandGlassView = {
    className: glassClassNames(settings, paused, hidden),
    palette,
    shader: settings.glassStyle === "shader",
    specular: settings.glassSpecular,
    paused,
    strength: glassColorStrength / 100,
    choice: glassBackdrop,
    blur: glassBlur,
    saturation: glassSaturation,
    contrastGuard: settings.glassContrastGuard,
    light: isLightIsland(background),
    onLayerState,
  };
  return { glass, glassStyle, layerState };
}
