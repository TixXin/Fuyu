import type { Context } from "@fuyu/plugin-base";
import type { ReactNode } from "react";
import { Segmented } from "./itemForm.tsx";
import { AHEAD_DAYS, METHODS, type CountdownSettings } from "./model.ts";
import { ItemList } from "./settingsItems.tsx";
import { text } from "./text.ts";
import { useCountdown, useToday } from "./useCountdown.ts";
import "./settings.css";

type Patch = (patch: Partial<CountdownSettings>) => void;
type FlagKey = "showDate" | "remindOnDay" | "remindAhead" | "showInBar";

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="fuyu-countdown-set__group">
      <h3 className="fuyu-countdown-set__title">{title}</h3>
      {hint && <p className="fuyu-countdown-set__hint">{hint}</p>}
      {children}
    </div>
  );
}

function Choice<K extends keyof CountdownSettings>({
  name,
  label,
  options,
  settings,
  patch,
  disabled,
}: {
  name: K;
  label: string;
  options: readonly (readonly [CountdownSettings[K] & (string | number), string])[];
  settings: CountdownSettings;
  patch: Patch;
  disabled?: boolean;
}) {
  return (
    <div className="fuyu-countdown-set__row">
      <span className="fuyu-countdown-set__label">{label}</span>
      <Segmented
        label={label}
        value={settings[name] as CountdownSettings[K] & (string | number)}
        options={options}
        disabled={disabled}
        onChange={(value) => patch({ [name]: value } as Partial<CountdownSettings>)}
      />
    </div>
  );
}

function Flag({ name, label, settings, patch }: { name: FlagKey; label: string; settings: CountdownSettings; patch: Patch }) {
  return (
    <label className="fuyu-countdown-set__check">
      <input type="checkbox" checked={settings[name]} onChange={(e) => patch({ [name]: e.target.checked })} />
      <span>{label}</span>
    </label>
  );
}

const ROWS = [
  [0, text.rowsNone],
  [3, "3"],
  [5, "5"],
  [10, "10"],
] as const;

export default function apply(ctx: Context) {
  function CountdownSection() {
    const { state, error, setError, invoke } = useCountdown(ctx);
    const at = useToday();
    const { settings } = state;
    const patch: Patch = (next) => invoke(METHODS.setSettings, next);
    return (
      <section className="fuyu-countdown-set">
        <Group title={text.itemsTitle} hint={text.itemsHint}>
          <ItemList items={state.items} at={at} invoke={invoke} onError={setError} />
        </Group>
        <Group title={text.displayTitle}>
          <Choice name="order" label={text.order} options={[["date", text.orderDate], ["manual", text.orderManual]]} settings={settings} patch={patch} />
          <Choice name="pageRows" label={text.pageRows} options={ROWS} settings={settings} patch={patch} />
          <Choice
            name="pastMode"
            label={text.pastMode}
            options={[["elapsed", text.pastElapsed], ["hide", text.pastHide], ["dim", text.pastDim]]}
            settings={settings}
            patch={patch}
          />
          <Flag name="showDate" label={text.showDate} settings={settings} patch={patch} />
        </Group>
        <Group title={text.remindTitle} hint={text.remindHint}>
          <Flag name="remindOnDay" label={text.remindOnDay} settings={settings} patch={patch} />
          <Flag name="remindAhead" label={text.remindAhead} settings={settings} patch={patch} />
          <Choice
            name="aheadDays"
            label={text.aheadDays}
            options={AHEAD_DAYS.map((n) => [n, text.aheadN(n)] as const)}
            settings={settings}
            patch={patch}
            disabled={!settings.remindAhead}
          />
        </Group>
        <Group title={text.barTitle}>
          <Flag name="showInBar" label={text.showInBar} settings={settings} patch={patch} />
          <Choice
            name="barTarget"
            label={text.barTarget}
            options={[["pinned", text.barPinned], ["nearest", text.barNearest]]}
            settings={settings}
            patch={patch}
            disabled={!settings.showInBar}
          />
          <Choice
            name="barStyle"
            label={text.barStyle}
            options={[["days", text.styleDays], ["icon", text.styleIcon], ["title", text.styleTitle]]}
            settings={settings}
            patch={patch}
            disabled={!settings.showInBar}
          />
        </Group>
        {error && <p className="fuyu-countdown-set__hint is-warn">{error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", { id: "countdown", category: "pluginsV3", component: CountdownSection });
}
