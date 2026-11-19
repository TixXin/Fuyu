import type { Context } from "@fuyu/plugin-base";
import { useEffect, useState, type ReactNode } from "react";
import { playChime } from "./chime.ts";
import { LIMITS, METHODS, type PomodoroSettings } from "./model.ts";
import { text } from "./text.ts";
import { usePomodoro } from "./usePomodoro.ts";
import "./settings.css";

type Patch = (patch: Partial<PomodoroSettings>) => void;
type NumberKey = keyof typeof LIMITS;
type FlagKey = "autoStartBreak" | "autoStartFocus" | "sound" | "todosExpanded" | "showInBar";

const S = text.set;

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="fuyu-pomodoro-set__group">
      <h3 className="fuyu-pomodoro-set__title">{title}</h3>
      {hint && <p className="fuyu-pomodoro-set__hint">{hint}</p>}
      {children}
    </div>
  );
}

function NumberField({ name, label, unit, settings, patch }: { name: NumberKey; label: string; unit: string; settings: PomodoroSettings; patch: Patch }) {
  const [min, max] = LIMITS[name];
  const value = settings[name];
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = (raw: string) => {
    const number = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(number)) return setDraft(String(value));
    const next = Math.min(max, Math.max(min, Math.round(number)));
    setDraft(String(next));
    if (next !== value) patch({ [name]: next });
  };
  return (
    <label className="fuyu-pomodoro-set__row">
      <span className="fuyu-pomodoro-set__label">{label}</span>
      <span className="fuyu-pomodoro-set__number">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            const number = Number(event.target.value);
            if (event.target.value.trim() !== "" && Number.isInteger(number) && number >= min && number <= max && number !== value) patch({ [name]: number });
          }}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit(event.currentTarget.value);
          }}
        />
        <span className="fuyu-pomodoro-set__unit">{unit}</span>
      </span>
    </label>
  );
}

function Flag({ name, label, settings, patch }: { name: FlagKey; label: string; settings: PomodoroSettings; patch: Patch }) {
  return (
    <label className="fuyu-pomodoro-set__check">
      <input type="checkbox" checked={settings[name]} onChange={(event) => patch({ [name]: event.target.checked })} />
      <span>{label}</span>
    </label>
  );
}

export default function apply(ctx: Context) {
  function PomodoroSection() {
    const { state, error, invoke } = usePomodoro(ctx);
    const { settings } = state;
    const patch: Patch = (next) => invoke(METHODS.setSettings, next);
    const field = { settings, patch };
    return (
      <section className="fuyu-pomodoro-set">
        <Group title={S.timingTitle}>
          <NumberField name="focusMinutes" label={S.focusMinutes} unit={S.minutes} {...field} />
          <NumberField name="shortBreakMinutes" label={S.shortBreakMinutes} unit={S.minutes} {...field} />
          <NumberField name="longBreakMinutes" label={S.longBreakMinutes} unit={S.minutes} {...field} />
          <NumberField name="roundsBeforeLong" label={S.roundsBeforeLong} unit={S.rounds} {...field} />
          <Flag name="autoStartBreak" label={S.autoStartBreak} {...field} />
          <Flag name="autoStartFocus" label={S.autoStartFocus} {...field} />
        </Group>
        <Group title={S.remindTitle}>
          <div className="fuyu-pomodoro-set__row">
            <Flag name="sound" label={S.sound} {...field} />
            <button type="button" className="fuyu-pomodoro-set__button" onClick={() => playChime()}>
              {S.preview}
            </button>
          </div>
          <NumberField name="dailyGoal" label={S.dailyGoal} unit={S.rounds} {...field} />
          <p className="fuyu-pomodoro-set__hint">{S.goalHint}</p>
        </Group>
        <Group title={S.displayTitle}>
          <Flag name="todosExpanded" label={S.todosExpanded} {...field} />
        </Group>
        <Group title={S.barTitle} hint={S.barHint}>
          <Flag name="showInBar" label={S.showInBar} {...field} />
        </Group>
        {error && <p className="fuyu-pomodoro-set__hint">{error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", { id: "pomodoro", category: "pluginsV3", component: PomodoroSection });
}
