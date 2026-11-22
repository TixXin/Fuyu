import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { NOTCH_COLORS, type NotchColor } from "../../../../lib/settings/notchSettingsModel";
import { RIM_PALETTE } from "../../../island/notch-rim/rimLook";
import "./NotchSwatches.css";

export function NotchSwatches({
  color,
  customColor,
  accent,
  labels,
  ariaLabel,
  onChange,
}: {
  color: NotchColor;
  customColor: string;
  accent: string;
  labels: Record<NotchColor, string>;
  ariaLabel: string;
  onChange: (patch: { color: NotchColor; customColor?: string }) => void;
}) {
  const paint = (value: NotchColor) => (value === "accent" ? accent : value === "custom" ? customColor : RIM_PALETTE[value]);
  return (
    <div className="notch-swatches" role="group" aria-label={ariaLabel}>
      {NOTCH_COLORS.map((value) => {
        const active = value === color;
        const className = `notch-swatches__swatch notch-swatches__swatch--${value}${active ? " notch-swatches__swatch--active" : ""}`;
        const style = { "--notch-swatch": paint(value) } as CSSProperties;
        const mark = active ? <Check className="notch-swatches__check" size={12} strokeWidth={3} aria-hidden="true" /> : null;
        if (value === "custom") {
          return (
            <label key={value} className={className} style={style} title={labels.custom}>
              <input
                type="color"
                value={customColor}
                aria-label={labels.custom}
                onClick={() => { if (!active) onChange({ color: "custom" }); }}
                onChange={(event) => onChange({ color: "custom", customColor: event.currentTarget.value })}
              />
              {mark}
            </label>
          );
        }
        return (
          <button key={value} type="button" className={className} style={style} title={labels[value]} aria-label={labels[value]} aria-pressed={active} onClick={() => onChange({ color: value })}>
            {mark}
          </button>
        );
      })}
    </div>
  );
}
