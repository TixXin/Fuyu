import { useId, type CSSProperties, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { SettingsRow } from "./SettingsRow";
import "./SettingsSliderRow.css";

export function SettingsSliderRow({
  title,
  description,
  value,
  min,
  max,
  step,
  format,
  defaultValue,
  resetLabel,
  indent,
  onChange,
}: {
  title: ReactNode;
  description?: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  defaultValue?: number;
  resetLabel?: string;
  indent?: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const canReset = defaultValue !== undefined && value !== defaultValue;

  return (
    <SettingsRow
      className="settings-row--slider"
      title={title}
      description={description}
      indent={indent}
      labelFor={id}
      control={
        <>
          {canReset ? (
            <button
              className="settings-slider__reset"
              type="button"
              aria-label={resetLabel}
              onClick={() => onChange(defaultValue)}
            >
              <RotateCcw size={13} strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : null}
          <input
            id={id}
            className="settings-slider"
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            style={{ "--settings-slider-fill": `${fill}%` } as CSSProperties}
            onChange={(event) => onChange(Number(event.currentTarget.value))}
          />
          <output className="settings-slider__value" htmlFor={id}>{format(value)}</output>
        </>
      }
    />

  );
}
