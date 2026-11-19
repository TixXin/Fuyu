import type { Context } from "@fuyu/plugin-base";
import { useState } from "react";
import { CitySearch } from "./citySearch.tsx";
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
import { GlobeIcon, MoonIcon, PlusIcon, SunIcon, XIcon } from "./icons.tsx";
import { MAX_CITIES, METHODS, TOPICS, cityLabel, primaryCity, type WorldCity, type WorldClockSettings, type WorldClockSnapshot } from "./model.ts";
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

function ClockRow({ row, now, settings, onRemove }: { row: Row; now: number; settings: WorldClockSettings; onRemove?: () => void }) {
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
      {onRemove && (
        <button type="button" className="fuyu-world-clock__remove" title={text.remove} aria-label={`${text.remove} ${row.label}`} onClick={onRemove}>
          <XIcon size={13} />
        </button>
      )}
    </li>
  );
}

export default function apply(ctx: Context) {
  function WorldClockPage() {
    const { state, error, invoke } = useWorldClock(ctx);
    const { settings } = state;
    const now = useNow(settings.showSeconds);
    const [adding, setAdding] = useState(false);
    const rows = rowsFor(state.cities, settings);
    return (
      <div className="fuyu-world-clock">
        {rows.length === 0 ? (
          <p className="fuyu-world-clock__note">{text.empty}</p>
        ) : (
          <ul className="fuyu-world-clock__list">
            {rows.map((row) => (
              <ClockRow
                key={row.key}
                row={row}
                now={now}
                settings={settings}
                onRemove={row.local ? undefined : () => invoke(METHODS.remove, { id: row.key })}
              />
            ))}
          </ul>
        )}
        {adding ? (
          <CitySearch cities={state.cities} invoke={invoke} inline autoFocus onClose={() => setAdding(false)} />
        ) : (
          state.cities.length < MAX_CITIES && (
            <button type="button" className="fuyu-world-clock__add" onClick={() => setAdding(true)}>
              <PlusIcon size={13} />
              {text.addCity}
            </button>
          )
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

  let removePage: (() => Promise<void>) | null = null;
  const syncPage = (show: boolean) => {
    if (show && !removePage) {
      removePage = ctx.slots.add("island.page/v1", { id: PAGE_ID, title: PAGE_TITLE, component: WorldClockPage, icon: GlobeIcon });
    } else if (!show && removePage) {
      void removePage();
      removePage = null;
    }
  };
  syncPage(true);
  const follow = (snapshot: WorldClockSnapshot) => syncPage(snapshot.settings.showPage);
  ctx.host.on(TOPICS.snapshot, follow);
  ctx.host.call<WorldClockSnapshot>(METHODS.snapshot).then(follow, () => {});
  ctx.slots.add("island.collapsed/v1", {
    id: "world-clock-bar",
    hideable: true,
    opens: PAGE_ID,
    component: WorldClockCollapsed,
  });
}
