import { useLocale, useTranslation } from "../../../i18n";
import type { CalendarEvent } from "../api";
import { clockTime } from "../upcoming";
import { calendarState } from "./islandState";
import "./monthWidget.css";

const DAY_MS = 86_400_000;

function dayStart(ms: number) {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function busyDays(events: readonly CalendarEvent[], from: number, to: number): Set<number> {
  const days = new Set<number>();
  for (const event of events) {
    if (event.declined || event.endMs <= from || event.startMs >= to) continue;
    const last = Math.min(to - 1, Math.max(event.startMs, event.endMs - 1));
    for (let day = dayStart(Math.max(from, event.startMs)); day <= last; day = dayStart(day + DAY_MS + 3_600_000)) days.add(day);
  }
  return days;
}

export function MonthWidget() {
  const t = useTranslation().islandWidgets;
  const { locale } = useLocale();
  const calendar = calendarState.use();
  const now = calendar?.now ?? Date.now();
  const today = new Date(now);
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1);
  const lead = first.getDay();
  const weeks = Math.ceil((lead + new Date(year, month + 1, 0).getDate()) / 7);
  const start = new Date(year, month, 1 - lead).getTime();
  const end = new Date(year, month, 1 - lead + weeks * 7).getTime();
  const events = calendar?.snapshot.events ?? [];
  const busy = busyDays(events, start, end);
  const todayStart = dayStart(now);
  const todayEvents = events.filter((event) => !event.declined && event.endMs > todayStart && event.startMs < todayStart + DAY_MS);
  const next = events.filter((event) => !event.declined && !event.allDay && event.endMs > now && event.startMs < todayStart + DAY_MS).sort((a, b) => a.startMs - b.startMs)[0];
  const weekdays = Array.from({ length: 7 }, (_, at) => new Date(2024, 0, 7 + at).toLocaleDateString(locale, { weekday: "narrow" }));
  return (
    <div className="island-widget month-widget">
      <div className="month-widget__head">
        <span className="month-widget__month">{first.toLocaleDateString(locale, { month: "long" })}</span>
        <span className="month-widget__muted">{year}</span>
        <span className="month-widget__muted month-widget__count">{t.content.eventsToday(todayEvents.length)}</span>
      </div>
      <div className="month-widget__grid">
        {weekdays.map((name, at) => (
          <b key={at}>{name}</b>
        ))}
        {Array.from({ length: weeks * 7 }, (_, at) => {
          const date = new Date(year, month, 1 - lead + at);
          const key = date.getTime();
          return (
            <span key={key} data-out={date.getMonth() !== month || undefined} data-today={key === todayStart || undefined} data-busy={busy.has(key) || undefined}>
              {date.getDate()}
            </span>
          );
        })}
      </div>
      {next ? (
        <div className="month-widget__next">
          <i aria-hidden="true" />
          <span className="month-widget__time">{clockTime(next.startMs)}</span>
          <span className="month-widget__title">{next.title}</span>
        </div>
      ) : null}
    </div>
  );
}
