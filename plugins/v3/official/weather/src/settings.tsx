import type { Context } from "@fuyu/plugin-base";
import { useEffect, useState, type ReactNode } from "react";
import { HOUR_CHOICES, LEAD_CHOICES, REFRESH_CHOICES, type WeatherConfig } from "./config.ts";
import { problemText, textFor } from "./text.ts";
import { useWeather } from "./useWeather.ts";
import "./styles.css";
import "./settings.css";

type Patch = (patch: Partial<WeatherConfig>) => void;
type ChoiceKey = "units" | "windUnit" | "timeFormat" | "barStyle";
type Copy = ReturnType<typeof textFor>;

function options(copy: Copy): Record<ChoiceKey, [string, string][]> {
  return {
    units: [
      ["celsius", copy.celsius],
      ["fahrenheit", copy.fahrenheit],
    ],
    windUnit: [
      ["kmh", "km/h"],
      ["ms", "m/s"],
      ["mph", "mph"],
      ["bft", copy.windBft],
    ],
    timeFormat: [
      ["system", copy.formatSystem],
      ["24", copy.format24],
      ["12", copy.format12],
    ],
    barStyle: [
      ["icon", copy.barIcon],
      ["text", copy.barText],
      ["temp", copy.barTemp],
    ],
  };
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="fuyu-weather-set__group">
      <h3 className="fuyu-weather-set__title">{title}</h3>
      {hint && <p className="fuyu-weather-set__hint">{hint}</p>}
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fuyu-weather-set__row">
      <span className="fuyu-weather-set__label">{label}</span>
      <div className="fuyu-weather-set__control">{children}</div>
    </div>
  );
}

function Choice({ name, label, config, patch, copy }: { name: ChoiceKey; label: string; config: WeatherConfig; patch: Patch; copy: Copy }) {
  return (
    <Row label={label}>
      <div className="fuyu-weather-set__seg" role="radiogroup" aria-label={label}>
        {options(copy)[name].map(([value, caption]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={config[name] === value}
            className={config[name] === value ? "fuyu-weather-set__seg-item is-on" : "fuyu-weather-set__seg-item"}
            onClick={() => patch({ [name]: value } as Partial<WeatherConfig>)}
          >
            {caption}
          </button>
        ))}
      </div>
    </Row>
  );
}

function NumberSelect({ label, value, choices, caption, onPick }: { label: string; value: number; choices: readonly number[]; caption: (n: number) => string; onPick: (n: number) => void }) {
  const list = choices.includes(value) ? choices : [...choices, value].sort((a, b) => a - b);
  return (
    <Row label={label}>
      <select className="fuyu-weather-set__input" aria-label={label} value={value} onChange={(e) => onPick(Number(e.target.value))}>
        {list.map((n) => (
          <option key={n} value={n}>
            {caption(n)}
          </option>
        ))}
      </select>
    </Row>
  );
}

function Flag({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className={disabled ? "fuyu-weather-set__check is-off" : "fuyu-weather-set__check"}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function CityField({ value, copy, onCommit }: { value: string; copy: Copy; onCommit: (city: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft.trim() !== value) onCommit(draft.trim());
  };
  return (
    <Row label={copy.cityLabel}>
      <input
        type="text"
        className="fuyu-weather-set__input fuyu-weather-set__city"
        aria-label={copy.cityLabel}
        value={draft}
        placeholder={copy.cityPlaceholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
      />
    </Row>
  );
}

export default function apply(ctx: Context) {
  function WeatherSection() {
    const { state, error, saveConfig } = useWeather(ctx);
    const { config } = state;
    const copy = textFor();
    const patch: Patch = saveConfig;
    return (
      <section className="fuyu-weather-set">
        <Group title={copy.placeTitle} hint={copy.placeHint}>
          <CityField value={config.city} copy={copy} onCommit={(city) => patch({ city })} />
          <Choice name="units" label={copy.unitsLabel} config={config} patch={patch} copy={copy} />
          <Choice name="windUnit" label={copy.windLabel} config={config} patch={patch} copy={copy} />
          <Choice name="timeFormat" label={copy.timeFormat} config={config} patch={patch} copy={copy} />
          <NumberSelect label={copy.refreshLabel} value={config.refreshMinutes} choices={REFRESH_CHOICES} caption={copy.minutes} onPick={(refreshMinutes) => patch({ refreshMinutes })} />
        </Group>
        <Group title={copy.pageTitle}>
          <Flag label={copy.showFeels} checked={config.showFeels} onChange={(showFeels) => patch({ showFeels })} />
          <Flag label={copy.showPop} checked={config.showPop} onChange={(showPop) => patch({ showPop })} />
          <Flag label={copy.showHumidity} checked={config.showHumidity} onChange={(showHumidity) => patch({ showHumidity })} />
          <Flag label={copy.showWind} checked={config.showWind} onChange={(showWind) => patch({ showWind })} />
          <NumberSelect label={copy.hoursLabel} value={config.hours} choices={HOUR_CHOICES} caption={copy.hoursCaption} onPick={(hours) => patch({ hours })} />
        </Group>
        <Group title={copy.barTitle}>
          <Flag label={copy.showOnBar} checked={config.showOnBar} onChange={(showOnBar) => patch({ showOnBar })} />
          {config.showOnBar && <Choice name="barStyle" label={copy.barStyle} config={config} patch={patch} copy={copy} />}
        </Group>
        <Group title={copy.rainSection} hint={copy.refreshHint}>
          <Flag label={copy.rainAlert} checked={config.rainAlert} onChange={(rainAlert) => patch({ rainAlert })} />
          {config.rainAlert && (
            <>
              <NumberSelect label={copy.rainLead} value={config.rainLeadMinutes} choices={LEAD_CHOICES} caption={copy.leadCaption} onPick={(rainLeadMinutes) => patch({ rainLeadMinutes })} />
              <Flag label={copy.quietHours} checked={config.quietHours} onChange={(quietHours) => patch({ quietHours })} />
              {config.quietHours && (
                <div className="fuyu-weather-set__quiet">
                  <span>{copy.quietFrom}</span>
                  <input
                    type="time"
                    className="fuyu-weather-set__input"
                    aria-label={`${copy.quietHours} ${copy.quietFrom}`}
                    value={config.quietStart}
                    onChange={(e) => e.target.value && patch({ quietStart: e.target.value })}
                  />
                  <span>{copy.quietTo}</span>
                  <input
                    type="time"
                    className="fuyu-weather-set__input"
                    aria-label={`${copy.quietHours} ${copy.quietTo}`}
                    value={config.quietEnd}
                    onChange={(e) => e.target.value && patch({ quietEnd: e.target.value })}
                  />
                </div>
              )}
            </>
          )}
        </Group>
        {(state.problem || error) && <p className="fuyu-weather-set__hint">{problemText(state.problem, copy) ?? error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", {
    id: "@fuyu/weather",
    category: "pluginsV3",
    component: WeatherSection,
  });
}
