import type { Context } from "@fuyu/plugin-base";
import { useEffect, useState } from "react";
import { playAlarmTone } from "./chime.ts";
import { ALARM_TONES, METHODS, TOPICS, nextScheduledAlarm, type AlarmTone, type RingingAlarm } from "./model.ts";
import { text } from "./text.ts";
import { useAlarm } from "./useAlarm.ts";
import "./styles.css";

function AlarmIcon({ size = 16 }: { size?: number | string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="13" r="8" />
      <path d="M5 3 2 6M22 6l-3-3M12 9v4l2 2" />
    </svg>
  );
}

function formatDays(days: readonly number[]): string {
  if (days.length === 0) return text.once;
  if (days.length === 7) return text.everyday;
  return days.map((d) => text.weekdays[d]).join(" ");
}

export default function apply(ctx: Context) {
  function AlarmRunner() {
    useEffect(() => {
      const off = ctx.host.on(TOPICS.ring, (ringing: RingingAlarm) => {
        playAlarmTone(ringing.tone);
      });
      return () => {
        void off();
      };
    }, []);
    return null;
  }

  function AlarmPage() {
    const { state, error, invoke } = useAlarm(ctx);
    const [time, setTime] = useState("08:30");
    const [label, setLabel] = useState("");
    const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
    const [tone, setTone] = useState<AlarmTone>(state.defaultTone);

    function toggleDay(day: number) {
      setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)));
    }

    function handleAdd() {
      if (!time) return;
      invoke(METHODS.add, { time, label: label.trim(), days, tone });
      setLabel("");
    }

    return (
      <div className="fuyu-alarm">
        {state.ringing && (
          <div className="fuyu-alarm__ring-banner">
            <div className="fuyu-alarm__ring-info">
              <strong>{state.ringing.label || text.ringingNow}</strong>
              <span>{state.ringing.time}</span>
            </div>
            <div className="fuyu-alarm__ring-actions">
              <button type="button" className="fuyu-alarm__mini" onClick={() => invoke(METHODS.snooze)}>
                {text.snooze}
              </button>
              <button type="button" className="fuyu-alarm__button" onClick={() => invoke(METHODS.dismiss)}>
                {text.dismiss}
              </button>
            </div>
          </div>
        )}

        <div className="fuyu-alarm__form">
          <div className="fuyu-alarm__form-top">
            <input type="time" className="fuyu-alarm__time-input" value={time} onChange={(e) => setTime(e.target.value)} />
            <input
              type="text"
              className="fuyu-alarm__input"
              placeholder={text.labelPlaceholder}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <select
              className="fuyu-alarm__select"
              value={tone}
              onChange={(e) => setTone(e.target.value as AlarmTone)}
            >
              {ALARM_TONES.map((item) => (
                <option key={item} value={item}>
                  {text.tones[item]}
                </option>
              ))}
            </select>
            <button type="button" className="fuyu-alarm__mini" onClick={() => playAlarmTone(tone)}>
              {text.preview}
            </button>
            <button type="button" className="fuyu-alarm__button" onClick={handleAdd}>
              {text.add}
            </button>
          </div>
          <div className="fuyu-alarm__days">
            {text.weekdays.map((dayLabel, idx) => (
              <button
                key={dayLabel}
                type="button"
                className={days.includes(idx) ? "fuyu-alarm__day fuyu-alarm__day--on" : "fuyu-alarm__day"}
                onClick={() => toggleDay(idx)}
              >
                {dayLabel}
              </button>
            ))}
          </div>
        </div>

        {state.alarms.length === 0 ? (
          <p className="fuyu-alarm__note">{text.empty}</p>
        ) : (
          <ul className="fuyu-alarm__list">
            {state.alarms.map((alarm) => (
              <li key={alarm.id} className={alarm.enabled ? "fuyu-alarm__row" : "fuyu-alarm__row fuyu-alarm__row--off"}>
                <div className="fuyu-alarm__row-main">
                  <span className="fuyu-alarm__row-time">{alarm.time}</span>
                  <span className="fuyu-alarm__row-meta">
                    {alarm.label ? `${alarm.label} · ` : ""}
                    {formatDays(alarm.days)} · {text.tones[alarm.tone]}
                  </span>
                </div>
                <div className="fuyu-alarm__row-actions">
                  <input
                    type="checkbox"
                    checked={alarm.enabled}
                    onChange={() => invoke(METHODS.toggle, { id: alarm.id })}
                  />
                  <button type="button" className="fuyu-alarm__mini" onClick={() => invoke(METHODS.remove, { id: alarm.id })}>
                    {text.remove}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="fuyu-alarm__note">{error}</p>}
      </div>
    );
  }

  function AlarmCollapsed() {
    const { state } = useAlarm(ctx);
    if (state.ringing) {
      return (
        <span className="fuyu-alarm-chip" title={state.ringing.label || text.ringingNow}>
          <AlarmIcon size={12} />
          <span className="fuyu-alarm-chip__time">{state.ringing.time}</span>
        </span>
      );
    }
    if (!state.showInBar) return null;
    const next = nextScheduledAlarm(state.alarms, state.at || Date.now());
    if (!next) return null;
    return (
      <span className="fuyu-alarm-chip" title={next.alarm.label || text.title}>
        <AlarmIcon size={12} />
        <span className="fuyu-alarm-chip__time">{next.alarm.time}</span>
      </span>
    );
  }

  ctx.slots.add("island.runner/v1", { id: "alarm-runner", component: AlarmRunner });
  ctx.slots.add("island.page/v1", { id: "alarm", component: AlarmPage, icon: AlarmIcon });
  ctx.slots.add("island.collapsed/v1", { id: "alarm-bar", width: 54, hideable: true, component: AlarmCollapsed });
}
