import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import type { TuckHintColor } from "../../../../lib/settings/types";
import { isLightIsland } from "../../../../utils/color";
import "./TuckSwatches.css";

const COLORS = ["contrast", "island", "custom"] as const satisfies readonly TuckHintColor[];

export function TuckSwatches({
  color,
  customColor,
  paint,
  labels,
  ariaLabel,
  onChange,
}: {
  color: TuckHintColor;
  customColor: string;
  paint: (color: TuckHintColor) => string;
  labels: Record<TuckHintColor, string>;
  ariaLabel: string;
  onChange: (patch: { tuckHintColor: TuckHintColor; tuckHintCustomColor?: string }) => void;
}) {
  return (
    <div className="tuck-swatches" role="group" aria-label={ariaLabel}>
      {COLORS.map((value) => {
        const active = value === color;
        const light = value !== "custom" || active ? isLightIsland(paint(value)) : false;
        const className = ["tuck-swatches__swatch", `tuck-swatches__swatch--${value}`, active && "tuck-swatches__swatch--active", light && "tuck-swatches__swatch--light"].filter(Boolean).join(" ");
        const style = { "--tuck-swatch": paint(value) } as CSSProperties;
        const mark = active ? <Check className="tuck-swatches__check" size={12} strokeWidth={3} aria-hidden="true" /> : null;
        if (value === "custom") {
          return (
            <label key={value} className={className} style={style} title={labels.custom}>
              <input
                type="color"
                value={customColor}
                aria-label={labels.custom}
                onClick={() => { if (!active) onChange({ tuckHintColor: "custom" }); }}
                onChange={(event) => onChange({ tuckHintColor: "custom", tuckHintCustomColor: event.currentTarget.value })}
              />
              {mark}
            </label>
          );
        }
        return (
          <button key={value} type="button" className={className} style={style} title={labels[value]} aria-label={labels[value]} aria-pressed={active} onClick={() => onChange({ tuckHintColor: value })}>
            {mark}
          </button>
        );
      })}
    </div>
  );
}
