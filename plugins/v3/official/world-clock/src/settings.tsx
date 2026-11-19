import type { Context } from "@fuyu/plugin-base";
import type { ReactNode } from "react";
import { METHODS, type WorldClockSettings } from "./model.ts";
import { CityList } from "./settingsCities.tsx";
import { text } from "./text.ts";
import { useWorldClock } from "./useWorldClock.ts";
import "./settings.css";

type Patch = (patch: Partial<WorldClockSettings>) => void;
type ChoiceKey = "timeFormat" | "dateMode" | "diffMode" | "barStyle";
type FlagKey = "showSeconds" | "showDayNight" | "showTimeZone" | "showLocal" | "showInBar";

const OPTIONS: Record<ChoiceKey, [string, string][]> = {
  timeFormat: [
    ["system", text.formatSystem],
    ["24", text.format24],
    ["12", text.format12],
  ],
  dateMode: [
    ["relative", text.dateRelative],
    ["always", text.dateAlways],
    ["none", text.dateNone],
  ],
  diffMode: [
    ["long", text.diffLong],
    ["short", text.diffShort],
    ["none", text.diffNone],
  ],
  barStyle: [
    ["name", text.barName],
    ["code", text.barCode],
    ["time", text.barTime],
  ],
};

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="fuyu-world-clock-set__group">
      <h3 className="fuyu-world-clock-set__title">{title}</h3>
      {hint && <p className="fuyu-world-clock-set__hint">{hint}</p>}
      {children}
    </div>
  );
}

function Choice({ name, label, settings, patch, disabled }: { name: ChoiceKey; label: string; settings: WorldClockSettings; patch: Patch; disabled?: boolean }) {
  return (
    <div className="fuyu-world-clock-set__row">
      <span className="fuyu-world-clock-set__label">{label}</span>
      <div className="fuyu-world-clock-set__seg" role="radiogroup" aria-label={label}>
        {OPTIONS[name].map(([value, caption]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={settings[name] === value}
            disabled={disabled}
            className={settings[name] === value ? "fuyu-world-clock-set__seg-item is-on" : "fuyu-world-clock-set__seg-item"}
            onClick={() => patch({ [name]: value } as Partial<WorldClockSettings>)}
          >
            {caption}
          </button>
        ))}
      </div>
    </div>
  );
}

function Flag({ name, label, settings, patch }: { name: FlagKey; label: string; settings: WorldClockSettings; patch: Patch }) {
  return (
    <label className="fuyu-world-clock-set__check">
      <input type="checkbox" checked={settings[name]} onChange={(e) => patch({ [name]: e.target.checked })} />
      <span>{label}</span>
    </label>
  );
}

export default function apply(ctx: Context) {
  function WorldClockSection() {
    const { state, error, invoke } = useWorldClock(ctx);
    const { settings } = state;
    const patch: Patch = (next) => invoke(METHODS.setSettings, next);
    return (
      <section className="fuyu-world-clock-set">
        <Group title={text.citiesTitle} hint={text.citiesHint}>
          <CityList cities={state.cities} invoke={invoke} />
          <Flag name="showLocal" label={text.showLocal} settings={settings} patch={patch} />
        </Group>
        <Group title={text.displayTitle}>
          <Choice name="timeFormat" label={text.timeFormat} settings={settings} patch={patch} />
          <Choice name="dateMode" label={text.dateMode} settings={settings} patch={patch} />
          <Choice name="diffMode" label={text.diffMode} settings={settings} patch={patch} />
          <Flag name="showSeconds" label={text.showSeconds} settings={settings} patch={patch} />
          <Flag name="showDayNight" label={text.showDayNight} settings={settings} patch={patch} />
          <Flag name="showTimeZone" label={text.showTimeZone} settings={settings} patch={patch} />
        </Group>
        <Group title={text.barTitle}>
          <Flag name="showInBar" label={text.showInBar} settings={settings} patch={patch} />
          <Choice name="barStyle" label={text.barStyle} settings={settings} patch={patch} disabled={!settings.showInBar} />
        </Group>
        {error && <p className="fuyu-world-clock-set__hint">{error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", { id: "world-clock", category: "pluginsV3", component: WorldClockSection });
}
