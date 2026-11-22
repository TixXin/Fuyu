import type { CSSProperties } from "react";
import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { useTranslation } from "../../../i18n";
import type { GlassPalette } from "../../../lib/theme/glassPalette";
import { GLASS_COLOR_SOURCES, type GlassSettingValues } from "../../../lib/settings/glassSettings";
import "./GlassColorRow.css";

const COLOR_KEYS = ["glassColor1", "glassColor2", "glassColor3"] as const;
type ColorKey = (typeof COLOR_KEYS)[number];
type ColorSource = GlassSettingValues["glassColorSource"];

export function GlassColorRow({ source, palette, onSource, onColor }: {
  source: ColorSource;
  palette: GlassPalette;
  onSource: (source: ColorSource) => void;
  onColor: (key: ColorKey, color: string) => void;
}) {
  const text = useTranslation().settings.appearance.glass;
  const custom = source === "custom";
  return (
    <SettingsRow
      className="glass-color-row"
      title={text.colorSource}
      description={source === "cover" ? text.coverHint : undefined}
      control={
        <>
          <SettingsChoice<ColorSource>
            value={source}
            options={GLASS_COLOR_SOURCES.map((value) => ({ value, label: text.colorSources[value] }))}
            ariaLabel={text.colorSource}
            onChange={onSource}
          />
          <span className="glass-swatches" role="group" aria-label={custom ? text.colorSources.custom : text.colorNow} title={custom ? undefined : text.colorNow}>
            {COLOR_KEYS.map((key, index) => {
              const color = palette[index];
              const style = { "--glass-swatch": color } as CSSProperties;
              if (!custom) return <span key={key} className="glass-swatches__swatch glass-swatches__swatch--still" style={style} aria-hidden="true" />;
              return (
                <label key={key} className="glass-swatches__swatch" style={style} title={text.color(index + 1)}>
                  <input type="color" value={color} aria-label={text.color(index + 1)} onChange={(event) => onColor(key, event.currentTarget.value)} />
                </label>
              );
            })}
          </span>
        </>
      }
    />
  );
}
