import type { CSSProperties } from "react";
import { SettingsChoiceCards } from "../../../components/settings/SettingsChoiceCards";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { useTranslation } from "../../../i18n";
import { BUILTIN_THEME_IDS, BUILTIN_THEMES, builtinThemeInUse, withBuiltinTheme, type BuiltinThemeId } from "../../../lib/theme/builtinThemes";
import { GLASS_LOOK_VALUES, GLASS_LOOKS, glassLookOf, type GlassLookId } from "../../../lib/theme/glassLooks";
import { hexToRgba } from "../../../lib/settings/settings";
import { islandInkRgb, type ThemeColors } from "../../../lib/theme/themeMode";
import type { IslandSettings } from "../../../lib/settings/types";
import "./BuiltinThemesSection.css";

export function BuiltinThemesSection({ settings, shown, onApply }: {
  settings: IslandSettings;
  shown: IslandSettings;
  onApply: (settings: IslandSettings) => void;
}) {
  const t = useTranslation().settings;
  const text = t.colors;
  const glassInUse = settings.appearanceMode === "liquidGlass" ? glassLookOf(settings) : null;
  const inUse: ThemeCard = builtinThemeInUse(settings) ?? (glassInUse ? `glass-${glassInUse}` : "custom");
  const builtins = BUILTIN_THEME_IDS.map((id) => ({
    value: id,
    label: text.builtinNames[id],
    hint: text.builtinHints[id],
    art: <ThemeArt colors={BUILTIN_THEMES[id].light} opacity={BUILTIN_THEMES[id].opacity} />,
  }));
  const glass = GLASS_LOOKS.map((id) => ({
    value: `glass-${id}` as const,
    label: t.appearance.glass.looks[id],
    hint: text.builtinGlassHints[id],
    art: <ThemeArt colors={shown} opacity={GLASS_LOOK_VALUES[id].glassIntensity} blur={GLASS_LOOK_VALUES[id].glassBlur} />,
  }));
  const custom = { value: "custom" as const, label: text.builtinCustom, hint: text.builtinCustomHint, art: <ThemeArt colors={shown} opacity={shown.opacity} /> };
  return (
    <SettingsGroup title={text.builtinTitle}>
      <SettingsRow title={text.builtin} description={text.builtinHint}>
        <SettingsChoiceCards<ThemeCard>
          value={inUse}
          ariaLabel={text.builtin}
          options={inUse === "custom" ? [...builtins, ...glass, custom] : [...builtins, ...glass]}
          onChange={(id) => {
            if (id.startsWith("glass-")) onApply({ ...settings, appearanceMode: "liquidGlass", ...GLASS_LOOK_VALUES[id.slice(6) as GlassLookId] });
            else if (id !== "custom") onApply(withBuiltinTheme(settings, id as BuiltinThemeId));
          }}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}

type ThemeCard = BuiltinThemeId | `glass-${GlassLookId}` | "custom";

function ThemeArt({ colors, opacity, blur }: { colors: ThemeColors; opacity: number; blur?: number }) {
  const style = {
    "--builtin-blur": blur === undefined ? undefined : `${blur / 3}px`,
    "--builtin-fill": hexToRgba(colors.islandBackgroundColor, opacity / 100),
    "--builtin-dot": colors.pulseColor,
    "--builtin-ink": islandInkRgb(colors),
  } as CSSProperties;
  return (
    <span className={blur === undefined ? "builtin-theme-art" : "builtin-theme-art builtin-theme-art--glass"} style={style}>
      <span className="builtin-theme-art__island">
        <i />
        <b />
        <b />
      </span>
    </span>
  );
}
