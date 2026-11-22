import { SettingsChoice } from "../../../../components/settings/SettingsChoice";
import { SettingsRow } from "../../../../components/settings/SettingsRow";
import { SettingsSliderRow } from "../../../../components/settings/SettingsSliderRow";
import { SettingsToggleRow } from "../../../../components/settings/SettingsToggleRow";
import type { SettingsNotchText } from "../../../../i18n/sections/settings/notch";
import { NOTCH_RING_BOTTOMS, NOTCH_RING_GAP, NOTCH_RING_INTENSITY, type NotchRingBottom } from "../../../../lib/settings/notchRingSettings";
import { NOTCH_WIDTH_LEVELS, nearestWidthLevel, type NotchShared, type NotchWidthLevel } from "../../../../lib/settings/notchSettingsModel";

export function NotchFineRows({
  text,
  shared,
  gap,
  bottom,
  defaults,
  onShared,
  onGap,
  onBottom,
}: {
  text: SettingsNotchText;
  shared: NotchShared;
  gap: number;
  bottom: NotchRingBottom;
  defaults: { intensity: number; gap: number };
  onShared: (patch: Partial<NotchShared>) => void;
  onGap: (gap: number) => void;
  onBottom: (bottom: NotchRingBottom) => void;
}) {
  const levels = Object.keys(NOTCH_WIDTH_LEVELS) as NotchWidthLevel[];
  return (
    <>
      <SettingsRow
        title={text.width}
        control={(
          <SettingsChoice
            value={nearestWidthLevel(shared.width)}
            options={levels.map((level) => ({ value: level, label: text.widths[level] }))}
            ariaLabel={text.width}
            onChange={(level) => onShared({ width: NOTCH_WIDTH_LEVELS[level] })}
          />
        )}
      />
      <SettingsSliderRow
        title={text.intensity}
        value={shared.intensity}
        min={NOTCH_RING_INTENSITY.min}
        max={NOTCH_RING_INTENSITY.max}
        step={5}
        format={(value) => `${value}%`}
        defaultValue={defaults.intensity}
        resetLabel={text.reset}
        onChange={(intensity) => onShared({ intensity })}
      />
      <SettingsSliderRow
        title={text.gap}
        description={text.gapHint}
        value={gap}
        min={NOTCH_RING_GAP.min}
        max={NOTCH_RING_GAP.max}
        step={1}
        format={(value) => `${value} px`}
        defaultValue={defaults.gap}
        resetLabel={text.reset}
        onChange={onGap}
      />
      <SettingsRow
        title={text.bottom}
        description={text.bottomHint}
        control={(
          <SettingsChoice
            value={bottom}
            options={NOTCH_RING_BOTTOMS.map((value) => ({ value, label: text.bottoms[value] }))}
            ariaLabel={text.bottom}
            onChange={onBottom}
          />
        )}
      />
      <SettingsToggleRow title={text.motion} description={text.motionHint} checked={shared.motion} onChange={(motion) => onShared({ motion })} />
    </>
  );
}
