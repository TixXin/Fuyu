import type { Context } from "@fuyu/plugin-base";
import { useState } from "react";
import { METHODS, PRESET_CITIES, formatZoneClock, isValidTimeZone, primaryCity, type WorldCity } from "./model.ts";
import { text } from "./text.ts";
import { useWorldClock } from "./useWorldClock.ts";
import "./styles.css";

function GlobeIcon({ size = 16 }: { size?: number | string }) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function cityName(city: WorldCity): string {
  return text.isZh ? city.labelZh : city.labelEn;
}

export default function apply(ctx: Context) {
  function WorldClockPage() {
    const { state, error, setError, invoke } = useWorldClock(ctx);
    const [selectedZone, setSelectedZone] = useState(PRESET_CITIES[0].timeZone);
    const [customZone, setCustomZone] = useState("");
    const at = state.at || Date.now();

    function handleAdd() {
      const zone = customZone.trim() || selectedZone;
      if (!isValidTimeZone(zone)) {
        setError(text.invalidZone);
        return;
      }
      invoke(METHODS.add, { timeZone: zone });
      setCustomZone("");
    }

    return (
      <div className="fuyu-world-clock">
        <div className="fuyu-world-clock__form">
          <select
            className="fuyu-world-clock__select"
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
          >
            {PRESET_CITIES.map((preset) => (
              <option key={preset.timeZone} value={preset.timeZone}>
                {text.isZh ? preset.labelZh : preset.labelEn} ({preset.shortCode})
              </option>
            ))}
          </select>
          <input
            type="text"
            className="fuyu-world-clock__input"
            placeholder={text.customPlaceholder}
            value={customZone}
            onChange={(e) => setCustomZone(e.target.value)}
          />
          <button type="button" className="fuyu-world-clock__button" onClick={handleAdd}>
            {text.add}
          </button>
        </div>

        {state.cities.length === 0 ? (
          <p className="fuyu-world-clock__note">{text.empty}</p>
        ) : (
          <ul className="fuyu-world-clock__list">
            {state.cities.map((city) => {
              const info = formatZoneClock(at, city.timeZone);
              const dayText = info.dayDiff === 1 ? text.tomorrow : info.dayDiff === -1 ? text.yesterday : text.today;
              const diffText =
                info.offsetHours === 0
                  ? text.sameZone
                  : info.offsetHours > 0
                    ? text.ahead(info.offsetHours)
                    : text.behind(info.offsetHours);

              return (
                <li key={city.id} className="fuyu-world-clock__row">
                  <div className="fuyu-world-clock__city">
                    <span className="fuyu-world-clock__name">
                      {cityName(city)} <span className="fuyu-world-clock__badge">{info.isDaytime ? text.day : text.night}</span>
                    </span>
                    <span className="fuyu-world-clock__sub">
                      {dayText} · {diffText}
                    </span>
                  </div>
                  <div className="fuyu-world-clock__right">
                    <span className="fuyu-world-clock__time">{info.hhmm}</span>
                    <button
                      type="button"
                      className={city.pinned ? "fuyu-world-clock__mini fuyu-world-clock__mini--active" : "fuyu-world-clock__mini"}
                      onClick={() => invoke(METHODS.pin, { id: city.id })}
                    >
                      {city.pinned ? text.pinned : text.pin}
                    </button>
                    <button type="button" className="fuyu-world-clock__mini" onClick={() => invoke(METHODS.remove, { id: city.id })}>
                      {text.remove}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {error && <p className="fuyu-world-clock__note">{error}</p>}
      </div>
    );
  }

  function WorldClockCollapsed() {
    const { state } = useWorldClock(ctx);
    if (!state.showInBar) return null;
    const city = primaryCity(state.cities);
    if (!city) return null;
    const info = formatZoneClock(state.at || Date.now(), city.timeZone);
    return (
      <span className="fuyu-world-clock-chip" title={`${cityName(city)} (${city.timeZone})`}>
        <span className="fuyu-world-clock-chip__code">{city.shortCode}</span>
        <span className="fuyu-world-clock-chip__time">{info.hhmm}</span>
      </span>
    );
  }

  ctx.slots.add("island.page/v1", { id: "world-clock", component: WorldClockPage, icon: GlobeIcon });
  ctx.slots.add("island.collapsed/v1", { id: "world-clock-bar", width: 66, hideable: true, component: WorldClockCollapsed });
}
