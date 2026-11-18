import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { SettingsSliderRow } from "../../../components/settings/SettingsSliderRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../../i18n";
import { DEFAULT_SETTINGS, MAX_IDLE_DIM_OPACITY, MIN_IDLE_DIM_OPACITY } from "../../../lib/settings/settings";
import type { IslandSettings } from "../../../lib/settings/types";

const IDLE_DIM_SECONDS = [5, 10, 15, 30, 60, 120, 300, 600];
const percent = (value: number) => `${Math.round(value)}%`;

export function IdleDimSettingsSection({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const t = useTranslation();
  const text = t.settings.appearance.idleDim;
  const layout = t.settings.layout;
  const update = (patch: Partial<IslandSettings>) => onSettingsChange({ ...settings, ...patch });
  const idleLabel = (value: number) => (value >= 60 && value % 60 === 0 ? layout.minutes(value / 60) : layout.seconds(value));
  const idleOptions = [...new Set([...IDLE_DIM_SECONDS, settings.idleDimSeconds])]
    .sort((a, b) => a - b)
    .map((value) => ({ value: String(value), label: idleLabel(value) }));

  return (
    <SettingsGroup title={text.title}>
      <SettingsToggleRow
        title={text.enable}
        description={text.enableHint}
        checked={settings.idleDim}
        onChange={(idleDim) => update({ idleDim })}
      />
      {settings.idleDim && (
        <>
          <SettingsRow
            indent
            title={text.seconds}
            control={
              <SettingsSelect
                value={String(settings.idleDimSeconds)}
                options={idleOptions}
                ariaLabel={text.seconds}
                onChange={(value) => update({ idleDimSeconds: Number(value) })}
              />
            }
          />
          <SettingsSliderRow
            indent
            title={text.opacity}
            value={settings.idleDimOpacity}
            min={MIN_IDLE_DIM_OPACITY}
            max={MAX_IDLE_DIM_OPACITY}
            step={1}
            format={percent}
            defaultValue={DEFAULT_SETTINGS.idleDimOpacity}
            resetLabel={layout.resetToDefault}
            onChange={(idleDimOpacity) => update({ idleDimOpacity })}
          />
        </>
      )}
    </SettingsGroup>
  );
}
