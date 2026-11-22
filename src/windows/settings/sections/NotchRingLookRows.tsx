import { SettingsColor } from "../../../components/settings/SettingsColor";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { SettingsSliderRow } from "../../../components/settings/SettingsSliderRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../../i18n";
import {
  NOTCH_RING_COLORS, NOTCH_RING_GAP, NOTCH_RING_INTENSITY, NOTCH_RING_STYLES, NOTCH_RING_WIDTH,
  type NotchRingLook,
} from "../../../lib/settings/notchRingSettings";

export function NotchRingLookRows({
  title,
  description,
  look,
  defaults,
  onChange,
}: {
  title: string;
  description: string;
  look: NotchRingLook;
  defaults: NotchRingLook;
  onChange: (patch: Partial<NotchRingLook>) => void;
}) {
  const text = useTranslation().settings.notchRing;
  const drawn = look.style !== "off";
  const lights = look.device || look.status;

  return (
    <>
      <SettingsRow
        title={title}
        description={`${description} ${text.styleHints[look.style]}`}
        control={(
          <SettingsSelect
            value={look.style}
            options={NOTCH_RING_STYLES.map((value) => ({ value, label: text.styles[value] }))}
            ariaLabel={title}
            onChange={(style) => onChange({ style })}
          />
        )}
      />
      {drawn && (
        <SettingsRow
          indent
          title={text.color}
          description={look.style === "aurora" ? text.colorAurora : undefined}
          control={(
            <SettingsSelect
              value={look.color}
              options={NOTCH_RING_COLORS.map((value) => ({ value, label: text.colors[value] }))}
              ariaLabel={text.color}
              onChange={(color) => onChange({ color })}
            />
          )}
        />
      )}
      {drawn && look.color === "custom" && (
        <SettingsRow
          indent={2}
          title={text.customColor}
          control={<SettingsColor value={look.customColor} ariaLabel={text.customColor} onChange={(customColor) => onChange({ customColor })} />}
        />
      )}
      {(drawn || lights) && (
        <SettingsSliderRow
          indent
          title={text.width}
          value={look.width}
          min={NOTCH_RING_WIDTH.min}
          max={NOTCH_RING_WIDTH.max}
          step={NOTCH_RING_WIDTH.step}
          format={(value) => `${value} px`}
          defaultValue={defaults.width}
          resetLabel={text.reset}
          onChange={(width) => onChange({ width })}
        />
      )}
      {(drawn || lights) && (
        <SettingsSliderRow
          indent
          title={text.gap}
          description={text.gapHint}
          value={look.gap}
          min={NOTCH_RING_GAP.min}
          max={NOTCH_RING_GAP.max}
          step={1}
          format={(value) => `${value} px`}
          defaultValue={defaults.gap}
          resetLabel={text.reset}
          onChange={(gap) => onChange({ gap })}
        />
      )}
      {(drawn || lights) && (
        <SettingsSliderRow
          indent
          title={text.intensity}
          value={look.intensity}
          min={NOTCH_RING_INTENSITY.min}
          max={NOTCH_RING_INTENSITY.max}
          step={5}
          format={(value) => `${value}%`}
          defaultValue={defaults.intensity}
          resetLabel={text.reset}
          onChange={(intensity) => onChange({ intensity })}
        />
      )}
      {(lights || (drawn && look.style !== "hairline")) && (
        <SettingsToggleRow indent title={text.motion} description={text.motionHint} checked={look.motion} onChange={(motion) => onChange({ motion })} />
      )}
      <SettingsToggleRow indent title={text.device} description={text.deviceHint} checked={look.device} onChange={(device) => onChange({ device })} />
      <SettingsToggleRow indent title={text.status} description={text.statusHint} checked={look.status} onChange={(status) => onChange({ status })} />
    </>
  );
}
