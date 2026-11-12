import { useId, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { clamp } from "../../utils/number";
import "./NumberControl.css";

export function NumberControl({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const inputId = useId();
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (raw: string) => {
    setDraft(null);
    const nextValue = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(nextValue)) {
      onChange(clamp(Math.round(nextValue), min, max));
    }
  };
  const step = (delta: number) => {
    setDraft(null);
    onChange(clamp(value + delta, min, max));
  };

  return (
    <div className="number-control">
      <label htmlFor={inputId}>{label}</label>
      <div className="number-control__field">
        <button type="button" tabIndex={-1} aria-hidden="true" disabled={value <= min} onClick={() => step(-1)}>
          <Minus size={13} strokeWidth={2.6} />
        </button>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          aria-valuemin={min}
          aria-valuemax={max}
          value={draft ?? String(value)}
          onChange={(event) => setDraft(event.currentTarget.value.replace(/[^\d-]/g, ""))}
          onBlur={(event) => commit(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit(event.currentTarget.value);
            else if (event.key === "Escape") setDraft(null);
            else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              step(event.key === "ArrowUp" ? 1 : -1);
            }
          }}
        />
        <button type="button" tabIndex={-1} aria-hidden="true" disabled={value >= max} onClick={() => step(1)}>
          <Plus size={13} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}
