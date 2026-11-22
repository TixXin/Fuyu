import { useEffect, useRef, useState, type ReactNode } from "react";
import "./SettingsThumbStrip.css";

export interface SettingsThumbOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export function SettingsThumbStrip<T extends string>({
  options,
  value,
  ariaLabel,
  renderArt,
  onChange,
  showHint = true,
  wide = false,
}: {
  options: readonly SettingsThumbOption<T>[];
  value: T;
  ariaLabel: string;
  renderArt: (value: T, live: boolean) => ReactNode;
  onChange: (value: T) => void;
  showHint?: boolean;
  wide?: boolean;
}) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [live, setLive] = useState<T | null>(null);
  const initial = useRef(value);

  useEffect(() => {
    const strip = stripRef.current;
    const chosen = strip?.querySelector<HTMLElement>(`[data-thumb="${initial.current}"]`);
    if (strip && chosen && chosen.offsetLeft + chosen.offsetWidth > strip.clientWidth) strip.scrollLeft = chosen.offsetLeft - 8;
  }, []);

  const leave = (option: T) => setLive((current) => (current === option ? null : current));
  const hint = showHint ? options.find((option) => option.value === value)?.hint : undefined;

  return (
    <div className="settings-thumbs">
      <div ref={stripRef} className="settings-thumbs__strip" role="group" aria-label={ariaLabel}>
        {options.map((option) => {
          const active = option.value === value;
          const className = ["settings-thumbs__item", active && "settings-thumbs__item--active", wide && "settings-thumbs__item--wide"].filter(Boolean).join(" ");
          return (
            <button
              key={option.value}
              type="button"
              className={className}
              aria-pressed={active}
              disabled={option.disabled}
              title={option.hint}
              data-thumb={option.value}
              onClick={() => onChange(option.value)}
              onPointerEnter={() => setLive(option.value)}
              onPointerLeave={() => leave(option.value)}
              onFocus={() => setLive(option.value)}
              onBlur={() => leave(option.value)}
            >
              <span className="settings-thumbs__art" aria-hidden="true">
                {renderArt(option.value, active || live === option.value)}
              </span>
              <span className="settings-thumbs__label">{option.label}</span>
            </button>
          );
        })}
      </div>
      {hint ? <p className="settings-thumbs__hint">{hint}</p> : null}
    </div>
  );
}
