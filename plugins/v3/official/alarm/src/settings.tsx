import type { Context } from "@fuyu/plugin-base";
import type { ReactNode } from "react";
import { playAlarmTone } from "./chime.ts";
import { displayFor } from "./display.ts";
import { ALARM_TONES, METHODS, type AlarmTone } from "./model.ts";
import { AlarmList } from "./settingsAlarms.tsx";
import { RING_CHOICES, SNOOZE_CHOICES, type AlarmSettings } from "./settingsModel.ts";
import { text } from "./text.ts";
import { useAlarm } from "./useAlarm.ts";
import "./styles.css";
import "./settings.css";

type Patch = (patch: Partial<AlarmSettings>) => void;
type ChoiceKey = "timeFormat" | "weekStart" | "onceAfter" | "barMode";

const OPTIONS: Record<ChoiceKey, [string, string][]> = {
  timeFormat: [
    ["system", text.formatSystem],
    ["24", text.format24],
    ["12", text.format12],
  ],
  weekStart: [
    ["system", text.weekSystem],
    ["mon", text.weekMon],
    ["sun", text.weekSun],
    ["sat", text.weekSat],
  ],
  onceAfter: [
    ["keep", text.onceKeep],
    ["delete", text.onceDelete],
  ],
  barMode: [
    ["ringing", text.barRinging],
    ["always", text.barAlways],
  ],
};

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="fuyu-alarm-set__group">
      <h3 className="fuyu-alarm-set__title">{title}</h3>
      {hint && <p className="fuyu-alarm-set__hint">{hint}</p>}
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fuyu-alarm-set__row">
      <span className="fuyu-alarm-set__label">{label}</span>
      <div className="fuyu-alarm-set__control">{children}</div>
    </div>
  );
}

function Choice({ name, label, settings, patch }: { name: ChoiceKey; label: string; settings: AlarmSettings; patch: Patch }) {
  return (
    <Row label={label}>
      <div className="fuyu-alarm-set__seg" role="radiogroup" aria-label={label}>
        {OPTIONS[name].map(([value, caption]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={settings[name] === value}
            className={settings[name] === value ? "fuyu-alarm-set__seg-item is-on" : "fuyu-alarm-set__seg-item"}
            onClick={() => patch({ [name]: value } as Partial<AlarmSettings>)}
          >
            {caption}
          </button>
        ))}
      </div>
    </Row>
  );
}

function NumberSelect({ label, value, choices, caption, onPick }: { label: string; value: number; choices: readonly number[]; caption: (n: number) => string; onPick: (n: number) => void }) {
  return (
    <Row label={label}>
      <select className="fuyu-alarm__select" aria-label={label} value={value} onChange={(e) => onPick(Number(e.target.value))}>
        {choices.map((n) => (
          <option key={n} value={n}>
            {caption(n)}
          </option>
        ))}
      </select>
    </Row>
  );
}

function Flag({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="fuyu-alarm-set__check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export default function apply(ctx: Context) {
  function AlarmSection() {
    const { state, error, invoke } = useAlarm(ctx);
    const { settings } = state;
    const view = displayFor(settings);
    const patch: Patch = (next) => invoke(METHODS.setSettings, next);
    return (
      <section className="fuyu-alarm-set">
        <Group title={text.alarmsTitle} hint={text.alarmsHint}>
          <AlarmList alarms={state.alarms} view={view} invoke={invoke} />
        </Group>
        <Group title={text.ringTitle}>
          <Row label={text.defaultTone}>
            <select
              className="fuyu-alarm__select"
              aria-label={text.defaultTone}
              value={settings.defaultTone}
              onChange={(e) => patch({ defaultTone: e.target.value as AlarmTone })}
            >
              {ALARM_TONES.map((tone) => (
                <option key={tone} value={tone}>
                  {text.tones[tone]}
                </option>
              ))}
            </select>
            <button type="button" className="fuyu-alarm__mini" onClick={() => playAlarmTone(settings.defaultTone, settings.volume / 100)}>
              {text.preview}
            </button>
          </Row>
          <Row label={text.volume}>
            <input
              type="range"
              className="fuyu-alarm-set__range"
              aria-label={text.volume}
              min={0}
              max={100}
              step={5}
              value={settings.volume}
              onChange={(e) => patch({ volume: Number(e.target.value) })}
            />
            <span className="fuyu-alarm-set__value">{settings.volume}%</span>
          </Row>
          <Flag label={text.fadeIn} checked={settings.fadeIn} onChange={(fadeIn) => patch({ fadeIn })} />
          <NumberSelect label={text.snoozeLength} value={settings.snoozeMinutes} choices={SNOOZE_CHOICES} caption={text.minutes} onPick={(snoozeMinutes) => patch({ snoozeMinutes })} />
          <NumberSelect label={text.ringLength} value={settings.ringSeconds} choices={RING_CHOICES} caption={text.seconds} onPick={(ringSeconds) => patch({ ringSeconds })} />
          <Choice name="onceAfter" label={text.onceAfter} settings={settings} patch={patch} />
          <Flag label={text.catchUp} checked={settings.catchUp} onChange={(catchUp) => patch({ catchUp })} />
        </Group>
        <Group title={text.displayTitle}>
          <Choice name="timeFormat" label={text.timeFormat} settings={settings} patch={patch} />
          <Choice name="weekStart" label={text.weekStart} settings={settings} patch={patch} />
        </Group>
        <Group title={text.barTitle} hint={text.barHint}>
          <Choice name="barMode" label={text.barMode} settings={settings} patch={patch} />
        </Group>
        {error && <p className="fuyu-alarm-set__hint">{error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", { id: "alarm", category: "pluginsV3", component: AlarmSection });
}
