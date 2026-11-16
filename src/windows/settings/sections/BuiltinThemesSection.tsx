import type { CSSProperties } from "react";
import { SettingsChoiceCards } from "../../../components/settings/SettingsChoiceCards";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { useTranslation } from "../../../i18n";
import { BUILTIN_THEME_IDS, BUILTIN_THEMES, builtinThemeInUse, withBuiltinTheme, type BuiltinThemeId } from "../../../lib/theme/builtinThemes";
import { hexToRgba } from "../../../lib/settings/settings";
import { islandInkRgb } from "../../../lib/theme/themeMode";
import type { IslandSettings } from "../../../lib/settings/types";
import "./BuiltinThemesSection.css";

export function BuiltinThemesSection({ settings, onApply }: {
  settings: IslandSettings;
  onApply: (settings: IslandSettings) => void;
}) {
  const text = useTranslation().settings.colors;
  const inUse = builtinThemeInUse(settings) ?? "none";
  return (
    <SettingsGroup title={text.builtinTitle}>
      <SettingsRow title={text.builtin} description={text.builtinHint}>
        <SettingsChoiceCards<BuiltinThemeId | "none">
          value={inUse}
          ariaLabel={text.builtin}
          options={BUILTIN_THEME_IDS.map((id) => ({ value: id, label: text.builtinNames[id], hint: text.builtinHints[id], art: <BuiltinThemeArt id={id} /> }))}
          onChange={(id) => {
            if (id !== "none") onApply(withBuiltinTheme(settings, id));
          }}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}

function BuiltinThemeArt({ id }: { id: BuiltinThemeId }) {
  const theme = BUILTIN_THEMES[id];
  const ink = islandInkRgb(theme.light);
  const style = {
    "--builtin-fill": hexToRgba(theme.light.islandBackgroundColor, theme.opacity / 100),
    "--builtin-dot": theme.light.pulseColor,
    "--builtin-ink": ink,
  } as CSSProperties;
  return (
    <span className="builtin-theme-art" style={style}>
      <span className="builtin-theme-art__island">
        <i />
        <b />
        <b />
      </span>
    </span>
  );
}
