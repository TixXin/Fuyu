import { SettingsColor } from "../../../components/settings/SettingsColor";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { SettingsSliderRow } from "../../../components/settings/SettingsSliderRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../../i18n";
import {
  NOTCH_RIM_COLORS, NOTCH_RIM_INTENSITY, NOTCH_RIM_STYLES, NOTCH_RIM_WIDTH,
  type NotchRimLook,
} from "../../../lib/settings/notchRimSettings";

export function NotchRimLookRows({
  title,
  description,
  look,
  defaults,
  onChange,
}: {
  title: string;
  description: string;
  look: NotchRimLook;
  defaults: NotchRimLook;
  onChange: (patch: Partial<NotchRimLook>) => void;
}) {
  const text = useTranslation().settings.notchRim;
  const drawn = look.style !== "off";

  return (
    <>
      <SettingsRow
        title={title}
        description={`${description} ${text.styleHints[look.style]}`}
        control={(
          <SettingsSelect
            value={look.style}
            options={NOTCH_RIM_STYLES.map((value) => ({ value, label: text.styles[value] }))}
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
              options={NOTCH_RIM_COLORS.map((value) => ({ value, label: text.colors[value] }))}
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
      {drawn && (
        <SettingsSliderRow
          indent
          title={text.width}
          value={look.width}
          min={NOTCH_RIM_WIDTH.min}
          max={NOTCH_RIM_WIDTH.max}
          step={NOTCH_RIM_WIDTH.step}
          format={(value) => `${value} px`}
          defaultValue={defaults.width}
          resetLabel={text.reset}
          onChange={(width) => onChange({ width })}
        />
      )}
      {drawn && (
        <SettingsSliderRow
          indent
          title={text.intensity}
          value={look.intensity}
          min={NOTCH_RIM_INTENSITY.min}
          max={NOTCH_RIM_INTENSITY.max}
          step={5}
          format={(value) => `${value}%`}
          defaultValue={defaults.intensity}
          resetLabel={text.reset}
          onChange={(intensity) => onChange({ intensity })}
        />
      )}
      {(look.status || (drawn && look.style !== "hairline")) && (
        <SettingsToggleRow indent title={text.motion} description={text.motionHint} checked={look.motion} onChange={(motion) => onChange({ motion })} />
      )}
      <SettingsToggleRow indent title={text.status} description={text.statusHint} checked={look.status} onChange={(status) => onChange({ status })} />
    </>
  );
}
