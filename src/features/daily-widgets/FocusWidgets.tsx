import { useEffect } from "react";
import { Flame, Pause, Play, RotateCcw, Target } from "lucide-react";
import { WidgetFrame } from "../../components/island-widget/WidgetFrame";
import { useTranslation } from "../../i18n";
import { dayKey, focusText, lastDays, streakLength } from "./days.ts";
import { POMODORO_MS } from "./storage.ts";
import { pausePomodoro, pomodoroLeft, resetPomodoro, settlePomodoro, startPomodoro, toggleCheckin, useDaily, useNow } from "./store.ts";
import { clickOnly } from "../../components/island-widget/clickOnly";

const RING_R = 36;
const RING_LENGTH = 2 * Math.PI * RING_R;

function clock(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function PomodoroWidget() {
  const t = useTranslation().islandWidgets.daily;
  const data = useDaily();
  const now = useNow(1000).getTime();
  const running = data.pomodoro.endsAt !== null;
  useEffect(() => settlePomodoro(now), [now]);
  const left = pomodoroLeft(now);
  const touched = !running && left < POMODORO_MS;
  return (
    <div className="island-widget daily-pomodoro" data-running={running || undefined}>
      <svg className="daily-ring" viewBox="0 0 84 84" aria-hidden="true">
        <circle className="daily-ring__track" cx="42" cy="42" r={RING_R} />
        <circle className="daily-ring__value" cx="42" cy="42" r={RING_R} strokeDasharray={RING_LENGTH} strokeDashoffset={RING_LENGTH * (left / POMODORO_MS)} />
      </svg>
      <div className="daily-pomodoro__center">
        <div className="daily-big daily-pomodoro__time">{clock(left)}</div>
        <div className="daily-pomodoro__buttons">
          <button className="daily-button" type="button" aria-label={running ? t.pause : t.start} title={running ? t.pause : t.start} onClick={clickOnly(() => (running ? pausePomodoro(Date.now()) : startPomodoro(Date.now())))}>
            {running ? <Pause size={11} strokeWidth={2.6} /> : <Play size={11} strokeWidth={2.6} />}
          </button>
          {touched ? (
            <button className="daily-button daily-button--plain" type="button" aria-label={t.reset} title={t.reset} onClick={clickOnly(resetPomodoro)}>
              <RotateCcw size={11} strokeWidth={2.4} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function StreakWidget() {
  const t = useTranslation().islandWidgets.daily;
  const data = useDaily();
  const now = useNow(60_000);
  const checked = new Set(data.checkins);
  const today = dayKey(now);
  const days = lastDays(now, 35);
  return (
    <WidgetFrame icon={Flame} title={t.names.streak} aside={<span className="daily-streak__count">{t.streakDays(streakLength(checked, now))}</span>} className="daily-streak">
      <div className="daily-heat">
        {days.map((day) =>
          day === today ? (
            <button key={day} className="daily-heat__cell" type="button" data-today="true" data-on={checked.has(day) || undefined} aria-pressed={checked.has(day)} aria-label={t.checkIn} title={t.checkIn} onClick={clickOnly(() => toggleCheckin(day))} />
          ) : (
            <i key={day} className="daily-heat__cell" data-on={checked.has(day) || undefined} />
          ),
        )}
      </div>
    </WidgetFrame>
  );
}

export function FocusWidget() {
  const t = useTranslation().islandWidgets.daily;
  const data = useDaily();
  const now = useNow(60_000);
  const days = lastDays(now, 7);
  const minutes = days.map((day) => data.focus[day] ?? 0);
  const top = Math.max(60, ...minutes);
  return (
    <WidgetFrame icon={Target} title={t.focusToday} className="daily-focus">
      <div className="daily-big daily-focus__total">{focusText(minutes[6] ?? 0)}</div>
      <div className="daily-focus__bars" aria-hidden="true">
        {minutes.map((value, at) => (
          <b key={days[at]} data-today={at === 6 || undefined} style={{ height: `${Math.max(6, (value / top) * 100)}%` }} />
        ))}
      </div>
    </WidgetFrame>
  );
}
