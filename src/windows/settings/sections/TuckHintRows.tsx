import { useTranslation } from "../../../i18n";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsThumbStrip } from "../../../components/settings/SettingsThumbStrip";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import type { IslandSettings, TuckHintColor, TuckHintStyle } from "../../../lib/settings/types";
import { TuckMock } from "./tuck/TuckMock";
import { tuckHintPaint, tuckHintRing } from "./tuck/tuckHintPaint";
import { TuckSwatches } from "./tuck/TuckSwatches";
import { useThumbPointer } from "./useThumbPointer";

const HINT_STYLES = ["none", "dot", "glow"] as const satisfies readonly TuckHintStyle[];

export function TuckHintRows({
  settings,
  update,
}: {
  settings: IslandSettings;
  update: (patch: Partial<IslandSettings>) => void;
}) {
  const expand = useTranslation().settings.expand;
  const { pointed, handlers } = useThumbPointer();
  const labels: Record<TuckHintStyle, string> = { none: expand.tuckHintNone, dot: expand.tuckHintDot, glow: expand.tuckHintGlow };
  const colorLabels: Record<TuckHintColor, string> = {
    contrast: expand.tuckHintColorContrast,
    island: expand.tuckHintColorIsland,
    custom: expand.tuckHintColorCustom,
  };
  const paint = (color: TuckHintColor) => tuckHintPaint(color, settings);
  const chosenPaint = paint(settings.tuckHintColor);
  const ring = tuckHintRing(settings.tuckHintColor, chosenPaint);
  const shown = settings.tuckHintStyle !== "none";

  return (
    <>
      <SettingsRow className="tuck-settings__strip-row" title={expand.tuckHint} description={expand.tuckHintHint}>
        <div className="tuck-settings__strip" {...handlers}>
          <SettingsThumbStrip<TuckHintStyle>
            options={HINT_STYLES.map((value) => ({ value, label: labels[value], hint: expand.tuckHintStyleHints[value] }))}
            value={settings.tuckHintStyle}
            ariaLabel={expand.tuckHint}
            onChange={(tuckHintStyle) => update({ tuckHintStyle })}
            renderArt={(value) => (
              <TuckMock
                tuckStyle="hidden"
                islandColor={settings.islandBackgroundColor}
                hint={{ style: value, paint: chosenPaint, ring, breathe: pointed === value && settings.tuckHintBreathe }}
              />
            )}
          />
        </div>
      </SettingsRow>
      {shown && (
        <SettingsRow
          title={expand.tuckHintColor}
          description={expand.tuckHintColorHint}
          control={(
            <TuckSwatches
              color={settings.tuckHintColor}
              customColor={settings.tuckHintCustomColor}
              paint={paint}
              labels={colorLabels}
              ariaLabel={expand.tuckHintColor}
              onChange={(patch) => update(patch)}
            />
          )}
        />
      )}
      {shown && (
        <SettingsToggleRow
          title={expand.tuckHintBreathe}
          description={expand.tuckHintBreatheHint}
          checked={settings.tuckHintBreathe}
          onChange={(tuckHintBreathe) => update({ tuckHintBreathe })}
        />
      )}
    </>
  );
}
