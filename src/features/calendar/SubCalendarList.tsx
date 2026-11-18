import { Bell, BellOff, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { SubCalendar } from "./api";
import { cycleCalendarColor, resolveCalendarColor, type CalendarPrefs } from "./calendarPrefs";

export function SubCalendarList({
  calendars,
  prefs,
  onPrefsChange,
}: {
  calendars: readonly SubCalendar[];
  prefs: CalendarPrefs;
  onPrefsChange: (next: CalendarPrefs) => void;
}) {
  const text = useTranslation().settings.calendar;
  if (calendars.length === 0) return null;

  const nativeMap: Record<string, string | null | undefined> = {};
  for (const item of calendars) {
    nativeMap[item.name] = item.color;
  }

  const toggleHidden = (name: string) => {
    const hidden = new Set(prefs.hiddenCalendars);
    if (hidden.has(name)) hidden.delete(name);
    else hidden.add(name);
    onPrefsChange({ ...prefs, hiddenCalendars: [...hidden] });
  };

  const toggleCountdown = (name: string) => {
    const blocked = new Set(prefs.noCountdownCalendars);
    if (blocked.has(name)) blocked.delete(name);
    else blocked.add(name);
    onPrefsChange({ ...prefs, noCountdownCalendars: [...blocked] });
  };

  const cycleColor = (name: string) => {
    const current = prefs.calendarColors[name] ?? null;
    const nextColor = cycleCalendarColor(current);
    const nextMap = { ...prefs.calendarColors };
    if (nextColor) nextMap[name] = nextColor;
    else delete nextMap[name];
    onPrefsChange({ ...prefs, calendarColors: nextMap });
  };

  return (
    <ul className="calendar-sublist">
      {calendars.map((sub) => {
        const hidden = prefs.hiddenCalendars.includes(sub.name);
        const noCountdown = prefs.noCountdownCalendars.includes(sub.name);
        const color = resolveCalendarColor(sub.name, prefs.calendarColors, nativeMap);
        return (
          <li key={sub.name} className={`calendar-sublist__item${hidden ? " calendar-sublist__item--hidden" : ""}`}>
            <button
              type="button"
              className="calendar-sublist__swatch"
              style={color ? { backgroundColor: color } : undefined}
              aria-label={text.subCalendarColor(sub.name)}
              onClick={() => cycleColor(sub.name)}
            />
            <span className="calendar-sublist__name">{sub.name}</span>
            <button
              type="button"
              className={`calendar-sublist__pill${!noCountdown && !hidden ? " calendar-sublist__pill--on" : ""}`}
              disabled={hidden}
              aria-pressed={!noCountdown}
              aria-label={text.subCalendarCountdownToggle(sub.name)}
              onClick={() => toggleCountdown(sub.name)}
            >
              {noCountdown ? <BellOff size={11} strokeWidth={2.2} aria-hidden="true" /> : <Bell size={11} strokeWidth={2.2} aria-hidden="true" />}
              {noCountdown ? text.subCalendarCountdownOff : text.subCalendarCountdownOn}
            </button>
            <button
              type="button"
              className="calendar-sublist__vis"
              aria-pressed={!hidden}
              aria-label={text.subCalendarShow(sub.name)}
              onClick={() => toggleHidden(sub.name)}
            >
              {hidden ? <EyeOff size={13} strokeWidth={2.1} aria-hidden="true" /> : <Eye size={13} strokeWidth={2.1} aria-hidden="true" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
