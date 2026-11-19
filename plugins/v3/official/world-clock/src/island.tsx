import type { Context } from "@fuyu/plugin-base";
import {
  dateText,
  diffText,
  formatTime,
  formatUtcOffset,
  joinTime,
  localTimeZone,
  systemUses12Hour,
  uses12Hour,
  zoneInfo,
} from "./clock.ts";
import { GlobeIcon, MoonIcon, SunIcon } from "./icons.tsx";
import { cityLabel, primaryCity, type WorldCity, type WorldClockSettings } from "./model.ts";
import { PAGE_TITLE, lang, text } from "./text.ts";
import { useNow, useWorldClock } from "./useWorldClock.ts";
import "./styles.css";

const PAGE_ID = "world-clock";
const SYSTEM_12 = systemUses12Hour();

type Row = { key: string; label: string; timeZone: string; local: boolean };

function rowsFor(cities: readonly WorldCity[], settings: WorldClockSettings): Row[] {
  const rows: Row[] = cities.map((city) => ({
    key: city.id,
    label: cityLabel(city, text.isZh),
    timeZone: city.timeZone,
    local: false,
  }));
  if (settings.showLocal) rows.unshift({ key: "local", label: text.local, timeZone: localTimeZone(), local: true });
  return rows;
}

function ClockRow({ row, now, settings }: { row: Row; now: number; settings: WorldClockSettings }) {
  const info = zoneInfo(now, row.timeZone);
  const time = formatTime(info.parts, uses12Hour(settings.timeFormat, SYSTEM_12), settings.showSeconds, lang);
  const subs = [
    dateText(now, row.timeZone, info, settings.dateMode, lang, text),
    row.local ? "" : diffText(info.offsetHours, settings.diffMode, text),
    settings.showTimeZone ? `${row.timeZone} · ${formatUtcOffset(info.utcOffsetMinutes)}` : "",
  ].filter(Boolean);
  const className = row.local ? "fuyu-world-clock__row fuyu-world-clock__row--local" : "fuyu-world-clock__row";
  return (
    <li className={className}>
      {settings.showDayNight && (
        <span className="fuyu-world-clock__daynight" title={info.isDaytime ? text.day : text.night}>
          {info.isDaytime ? <SunIcon /> : <MoonIcon />}
        </span>
      )}
      <div className="fuyu-world-clock__city">
        <span className="fuyu-world-clock__name">{row.label}</span>
        {subs.length > 0 && <span className="fuyu-world-clock__sub">{subs.join(" · ")}</span>}
      </div>
      <span className="fuyu-world-clock__time">
        {time.period && lang === "zh" && <small className="fuyu-world-clock__period">{time.period}</small>}
        {time.time}
        {time.period && lang === "en" && <small className="fuyu-world-clock__period">{time.period}</small>}
      </span>
    </li>
  );
}

export default function apply(ctx: Context) {
  function WorldClockPage() {
    const { state, error } = useWorldClock(ctx);
    const { settings } = state;
    const now = useNow(settings.showSeconds);
    const rows = rowsFor(state.cities, settings);
    return (
      <div className="fuyu-world-clock">
        {rows.length === 0 ? (
          <p className="fuyu-world-clock__note">{text.empty}</p>
        ) : (
          <ul className="fuyu-world-clock__list">
            {rows.map((row) => (
              <ClockRow key={row.key} row={row} now={now} settings={settings} />
            ))}
          </ul>
        )}
        {error && <p className="fuyu-world-clock__note">{error}</p>}
      </div>
    );
  }

  function WorldClockCollapsed() {
    const { state } = useWorldClock(ctx);
    const { settings } = state;
    const now = useNow(settings.showSeconds);
    const city = primaryCity(state.cities);
    if (!settings.showInBar || !city) return null;
    const info = zoneInfo(now, city.timeZone);
    const time = joinTime(formatTime(info.parts, uses12Hour(settings.timeFormat, SYSTEM_12), settings.showSeconds, lang), lang);
    const label = cityLabel(city, text.isZh);
    const lead = settings.barStyle === "name" ? label : settings.barStyle === "code" ? city.shortCode : "";
    return (
      <span className="fuyu-world-clock-chip" title={`${label} ${time}`}>
        {lead && <span className="fuyu-world-clock-chip__lead">{lead}</span>}
        <span className="fuyu-world-clock-chip__time">{time}</span>
      </span>
    );
  }

  ctx.slots.add("island.page/v1", { id: PAGE_ID, title: PAGE_TITLE, component: WorldClockPage, icon: GlobeIcon });
  ctx.slots.add("island.collapsed/v1", {
    id: "world-clock-bar",
    width: 120,
    hideable: true,
    opens: PAGE_ID,
    component: WorldClockCollapsed,
  });
}
