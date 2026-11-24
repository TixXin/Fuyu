import type { KeyboardEvent } from "react";
import { conditionKind, conditionLabel } from "./conditions.ts";
import {
  aqiInfo,
  clockOfIso,
  formatClock,
  systemUses12Hour,
  tempRangeBar,
  uses12Hour,
  weekdayOf,
} from "./format.ts";
import { ConditionIcon, WeatherIcon } from "./icons.tsx";
import { currentLocale } from "./locale.ts";
import { textFor } from "./text.ts";
import { formatTemp, type WeatherState } from "./types.ts";
import "./widget.css";

const SYSTEM_12 = systemUses12Hour();

function activateOnKey(action: (() => void) | null) {
  return (e: KeyboardEvent) => {
    if (!action) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  };
}

export function WeatherWidget({
  state,
  width,
  height,
  onOpenPage,
  onOpenSettings,
}: {
  state: WeatherState;
  width: number;
  height: number;
  onOpenPage: (() => void) | null;
  onOpenSettings: (() => void) | null;
}) {
  const { config } = state;
  const place = state.primaryPlace ?? state.place;
  const forecast = state.primaryForecast ?? state.forecast;
  const aqi = state.primaryAqi ?? state.aqi;
  const locale = currentLocale();
  const copy = textFor(locale);
  const hasCity = config.cities.length > 0 || config.city !== "";

  if (!hasCity || !forecast) {
    const action = !hasCity ? onOpenSettings : onOpenPage;
    return (
      <div
        className={action ? "fuyu-weather-widget is-empty is-clickable" : "fuyu-weather-widget is-empty"}
        role={action ? "button" : undefined}
        tabIndex={action ? 0 : undefined}
        onClick={() => action?.()}
        onKeyDown={activateOnKey(action)}
      >
        <WeatherIcon />
        <span>{hasCity ? copy.loading : copy.setupHint}</span>
      </div>
    );
  }

  const wide = width >= 200;
  const extraWide = width >= 340;
  const tall = height >= 190;
  const twelve = uses12Hour(config.timeFormat, SYSTEM_12);
  const today = forecast.daily[0];
  const hiLo = today ? `${formatTemp(today.min)} / ${formatTemp(today.max)}` : "";
  const aqiBadge = config.showAqi && aqi ? aqiInfo(aqi.usAqi, copy.isZh) : null;

  const days = tall ? forecast.daily.slice(0, Math.max(2, Math.floor((height - 114) / 23))) : [];
  const weekMin = days.length > 0 ? Math.min(...days.map((d) => d.min)) : 0;
  const weekMax = days.length > 0 ? Math.max(...days.map((d) => d.max)) : 0;
  const miniHours = !tall && extraWide ? forecast.hourly.slice(0, 4) : [];

  const rootClass = [
    "fuyu-weather-widget",
    wide ? "is-wide" : "",
    tall ? "is-tall" : "",
    !tall && wide ? "is-row" : "",
    onOpenPage ? "is-clickable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rootClass}
      role={onOpenPage ? "button" : undefined}
      tabIndex={onOpenPage ? 0 : undefined}
      onClick={() => onOpenPage?.()}
      onKeyDown={activateOnKey(onOpenPage)}
    >
      <div className="fuyu-weather-widget__main">
        <div className="fuyu-weather-widget__head">
          <span className="fuyu-weather-widget__place">{place?.name ?? config.city}</span>
          {hiLo && !tall && wide && <span className="fuyu-weather-widget__hilo">{hiLo}</span>}
          {tall && aqiBadge && aqi && (
            <span className={`fuyu-weather__aqi is-${aqiBadge.tone}`}>{`${copy.aqi} ${aqi.usAqi}`}</span>
          )}
        </div>
        <div className="fuyu-weather-widget__now">
          <ConditionIcon kind={conditionKind(forecast.current.code)} day={forecast.current.day} size={wide ? 30 : 24} tinted />
          <span className="fuyu-weather-widget__temp">{formatTemp(forecast.current.temp)}</span>
        </div>
        <div className="fuyu-weather-widget__foot">
          <span className="fuyu-weather-widget__cond">{conditionLabel(forecast.current.code, locale, !wide)}</span>
          {hiLo && (!wide || tall) && <span className="fuyu-weather-widget__hilo">{hiLo}</span>}
        </div>
      </div>

      {!tall && wide && !extraWide && (
        <div className="fuyu-weather-widget__side">
          {config.showFeels && (
            <span className="fuyu-weather-widget__stat">{`${copy.feels} ${formatTemp(forecast.current.feels)}`}</span>
          )}
          {config.showPop && forecast.hourly[0] && (
            <span className="fuyu-weather-widget__stat">{`${copy.pop} ${Math.round(forecast.hourly[0].pop)}%`}</span>
          )}
          {aqiBadge && aqi && (
            <span className={`fuyu-weather__aqi is-${aqiBadge.tone}`}>{`${copy.aqi} ${aqi.usAqi} ${aqiBadge.label}`}</span>
          )}
        </div>
      )}

      {miniHours.length > 0 && (
        <div className="fuyu-weather-widget__hours">
          {miniHours.map((hour) => (
            <div key={hour.time} className="fuyu-weather-widget__hour">
              <span className="fuyu-weather-widget__hour-time">{formatClock(clockOfIso(hour.time), twelve, copy.isZh)}</span>
              <ConditionIcon kind={conditionKind(hour.code)} day={hour.day} size={14} tinted />
              <span className="fuyu-weather-widget__hour-temp">{formatTemp(hour.temp)}</span>
            </div>
          ))}
        </div>
      )}

      {days.length > 0 && (
        <ul className="fuyu-weather-widget__days">
          {days.map((day, idx) => {
            const bar = tempRangeBar(day.min, day.max, weekMin, weekMax);
            return (
              <li key={day.date}>
                <span className="fuyu-weather-widget__day-name">
                  {idx === 0 ? copy.today : copy.weekdays[weekdayOf(day.date)] ?? day.date.slice(5)}
                </span>
                <ConditionIcon kind={conditionKind(day.code)} size={14} tinted />
                <span className="fuyu-weather-widget__day-lo">{formatTemp(day.min)}</span>
                <span className="fuyu-weather__bar-track" aria-hidden="true">
                  <span className="fuyu-weather__bar-fill" style={{ left: `${bar.left}%`, width: `${bar.width}%` }} />
                </span>
                <span className="fuyu-weather-widget__day-hi">{formatTemp(day.max)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
