import { useMemo } from "react";
import type { CSSProperties } from "react";
import { glassClassNames, glassPalette, glassPaused, glassVariables, type GlassPalette } from "../../lib/theme/glassPalette";
import type { IslandSettings } from "../../lib/settings/types";
import { usePageHidden } from "../../lib/usePageHidden";
import type { IslandMode } from "./types";

export type IslandGlassView = {
  className: string;
  palette: GlassPalette;
  shader: boolean;
  specular: boolean;
  paused: boolean;
  strength: number;
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
  const { glassColorSource, glassColor1, glassColor2, glassColor3, glassContrastGuard } = settings;
  const palette = useMemo(
    () => glassPalette({
      settings: { glassColorSource, glassColor1, glassColor2, glassColor3, glassContrastGuard },
      accent,
      cover,
      background,
    }),
    [glassColorSource, glassColor1, glassColor2, glassColor3, glassContrastGuard, accent, cover, background],
  );
  const { glassColorStrength, glassFlowSpeed, glassBlobScale, glassRimWidth } = settings;
  const glassStyle = useMemo(
    () => glassVariables({ glassColorStrength, glassFlowSpeed, glassBlobScale, glassRimWidth }, palette) as CSSProperties,
    [glassColorStrength, glassFlowSpeed, glassBlobScale, glassRimWidth, palette],
  );
  const paused = glassPaused(settings, { mode, isTucked, quiet, hidden, reducedMotion });
  const glass: IslandGlassView = {
    className: glassClassNames(settings, paused),
    palette,
    shader: settings.glassStyle === "shader",
    specular: settings.glassSpecular,
    paused,
    strength: glassColorStrength / 100,
  };
  return { glass, glassStyle };
}
