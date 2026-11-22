import type { CSSProperties } from "react";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsSliderRow } from "../../../components/settings/SettingsSliderRow";
import { useTranslation } from "../../../i18n";
import { DEFAULT_SETTINGS, MAX_ISLAND_OPACITY, MIN_ISLAND_OPACITY } from "../../../lib/settings/settings";
import type { IslandSettings } from "../../../lib/settings/types";
import "./OpacityCards.css";

const percent = (value: number) => `${Math.round(value)}%`;

function OpacityArt({ fill, whole, background }: { fill: number; whole: number; background: string }) {
  const style = { "--opacity-art-fill": `${fill}%`, "--opacity-art-whole": whole / 100, "--opacity-art-bg": background } as CSSProperties;
  return (
    <span className="opacity-card__art" aria-hidden="true" style={style}>
      <span className="opacity-card__island">
        <span className="opacity-card__dot" />
        <span className="opacity-card__time">9:41</span>
      </span>
    </span>
  );
}

export function OpacityCards({ settings, onSettingsChange }: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const t = useTranslation();
  const layout = t.settings.layout;
  const text = t.settings.appearance;
  const background = settings.islandBackgroundColor || "#000000";

  return (
    <SettingsGroup title={text.opacityTitle}>
      <div className="opacity-cards">
        <div className="opacity-cards__grid">
          <SettingsSliderRow
            className="opacity-card"
            title={layout.opacity}
            description={text.opacityFillHint}
            value={settings.opacity}
            min={50}
            max={100}
            step={1}
            format={percent}
            defaultValue={DEFAULT_SETTINGS.opacity}
            resetLabel={layout.resetToDefault}
            onChange={(opacity) => onSettingsChange({ ...settings, opacity })}
          >
            <OpacityArt fill={settings.opacity} whole={100} background={background} />
          </SettingsSliderRow>
          <SettingsSliderRow
            className="opacity-card"
            title={layout.islandOpacity}
            description={text.opacityWholeHint}
            value={settings.islandOpacity}
            min={MIN_ISLAND_OPACITY}
            max={MAX_ISLAND_OPACITY}
            step={1}
            format={percent}
            defaultValue={DEFAULT_SETTINGS.islandOpacity}
            resetLabel={layout.resetToDefault}
            onChange={(islandOpacity) => onSettingsChange({ ...settings, islandOpacity })}
          >
            <OpacityArt fill={100} whole={settings.islandOpacity} background={background} />
          </SettingsSliderRow>
        </div>
      </div>
    </SettingsGroup>
  );
}
