import type { Context } from "@fuyu/plugin-base";
import { conditionKind, conditionLabel } from "./conditions.ts";
import {
  aqiInfo,
  clockOfIso,
  clockOfMs,
  formatClock,
  formatWind,
  placeLine,
  sameLocalDay,
  systemUses12Hour,
  tempRangeBar,
  uses12Hour,
  uvLevel,
  weekdayOf,
} from "./format.ts";
import { ConditionIcon, RefreshIcon, SunriseIcon, SunsetIcon, WeatherIcon } from "./icons.tsx";
import { currentLocale } from "./locale.ts";
import { PAGE_TITLE, problemText, textFor } from "./text.ts";
import { formatTemp, type WeatherForecast, type WeatherState } from "./types.ts";
import { useWeather } from "./useWeather.ts";
import { WeatherWidget } from "./widget.tsx";
import "./styles.css";

const PAGE_ID = "@fuyu/weather";
const SYSTEM_12 = systemUses12Hour();

type SettingsOpener = { settings?: { open?: () => unknown } };
type IslandOpener = { island?: { open?: (page?: string) => unknown } };

function settingsOpener(ctx: Context): (() => void) | null {
  const holder = (ctx as unknown as SettingsOpener).settings;
  const open = holder?.open;
  return typeof open === "function" ? () => void open.call(holder) : null;
}

function islandOpener(ctx: Context): (() => void) | null {
  const holder = (ctx as unknown as IslandOpener).island;
  const open = holder?.open;
  return typeof open === "function" ? () => void open.call(holder, PAGE_ID) : null;
}

function heroStats(forecast: WeatherForecast, state: WeatherState, copy: ReturnType<typeof textFor>): string {
  const { config } = state;
  const parts: string[] = [];
  if (config.showFeels) parts.push(`${copy.feels} ${formatTemp(forecast.current.feels)}`);
  if (config.showPop && forecast.hourly[0]) parts.push(`${copy.pop} ${Math.round(forecast.hourly[0].pop)}%`);
  if (config.showHumidity) parts.push(`${copy.humidity} ${Math.round(forecast.current.humidity)}%`);
  if (config.showWind) parts.push(`${copy.wind} ${formatWind(forecast.current.wind, config.windUnit, copy.isZh)}`);
  return parts.join(" · ");
}

export default function apply(ctx: Context) {
  const openSettings = settingsOpener(ctx);
  const openPage = islandOpener(ctx);

  function WeatherPage() {
    const { state, error, refresh, selectCity } = useWeather(ctx);
    const locale = currentLocale();
    const copy = textFor(locale);
    const { config, activeCityId, place, forecast, aqi, loading, problem, fetchedAt } = state;
    const twelve = uses12Hour(config.timeFormat, SYSTEM_12);
    const hasCity = config.cities.length > 0 || config.city !== "";

    if (!hasCity) {
      return (
        <div className="fuyu-weather">
          <div className="fuyu-weather__empty">
            <strong className="fuyu-weather__title">{copy.emptyTitle}</strong>
            <p className="fuyu-weather__note">{openSettings ? copy.emptyBody : copy.emptyNoButton}</p>
            {openSettings && (
              <button type="button" className="fuyu-weather__button" onClick={openSettings}>
                {copy.goSettings}
              </button>
            )}
          </div>
        </div>
      );
    }

    const now = Date.now();
    const updated =
      typeof fetchedAt === "number"
        ? `${sameLocalDay(fetchedAt, now) ? "" : `${new Date(fetchedAt).getMonth() + 1}/${new Date(fetchedAt).getDate()} `}${formatClock(clockOfMs(fetchedAt), twelve, copy.isZh)}`
        : null;
    const stale = Boolean(problem?.kind === "offline" && forecast);
    const stats = forecast ? heroStats(forecast, state, copy) : "";
    const today = forecast?.daily[0];
    const uvVal = forecast?.current.uv ?? today?.uvMax;
    const hasSunUv = Boolean(
      config.showSunUv && forecast && (today?.sunrise || today?.sunset || typeof uvVal === "number"),
    );
    const aqiBadge = config.showAqi && aqi ? aqiInfo(aqi.usAqi, copy.isZh) : null;
    const weekMin = forecast && forecast.daily.length > 0 ? Math.min(...forecast.daily.map((d) => d.min)) : 0;
    const weekMax = forecast && forecast.daily.length > 0 ? Math.max(...forecast.daily.map((d) => d.max)) : 0;
    const placeTitle = place ? placeLine(place) : config.city;

    return (
      <div className="fuyu-weather">
        {config.cities.length > 1 && (
          <div className="fuyu-weather__cities" role="tablist" aria-label={copy.title}>
            {config.cities.map((city) => {
              const active = city.id === activeCityId;
              return (
                <button
                  key={city.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={active ? "fuyu-weather__city-tab is-on" : "fuyu-weather__city-tab"}
                  title={placeLine(city)}
                  onClick={() => selectCity(city.id)}
                >
                  {city.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="fuyu-weather__top">
          <div className="fuyu-weather__place-wrap">
            <h3 className="fuyu-weather__title" title={placeTitle}>
              {place?.name ?? config.city}
            </h3>
            <span className={stale ? "fuyu-weather__sub is-stale" : "fuyu-weather__sub"}>
              {loading ? copy.loading : stale ? copy.stale : updated ? copy.updatedAt(updated) : ""}
            </span>
          </div>
          <button
            type="button"
            className="fuyu-weather__icon-button"
            disabled={loading}
            onClick={refresh}
            title={copy.refresh}
            aria-label={copy.refresh}
          >
            <RefreshIcon />
          </button>
        </div>

        {forecast && (
          <>
            <div className="fuyu-weather__hero">
              <span className="fuyu-weather__hero-icon">
                <ConditionIcon kind={conditionKind(forecast.current.code)} day={forecast.current.day} size={28} tinted />
              </span>
              <span className="fuyu-weather__temp">{formatTemp(forecast.current.temp)}</span>
              <div className="fuyu-weather__hero-meta">
                <div className="fuyu-weather__cond-row">
                  <span className="fuyu-weather__cond">{conditionLabel(forecast.current.code, locale)}</span>
                  {today && (
                    <span className="fuyu-weather__hilo">{`${formatTemp(today.min)} / ${formatTemp(today.max)}`}</span>
                  )}
                  {aqiBadge && aqi && (
                    <span className={`fuyu-weather__aqi is-${aqiBadge.tone}`}>
                      {`${copy.aqi} ${aqi.usAqi} ${aqiBadge.label}`}
                    </span>
                  )}
                </div>
                {stats && <span className="fuyu-weather__stats">{stats}</span>}
              </div>
            </div>

            {hasSunUv && (
              <div className="fuyu-weather__extras">
                {today?.sunrise && (
                  <span className="fuyu-weather__extra">
                    <SunriseIcon />
                    <span>{`${copy.sunrise} ${formatClock(clockOfIso(today.sunrise), twelve, copy.isZh)}`}</span>
                  </span>
                )}
                {today?.sunset && (
                  <span className="fuyu-weather__extra">
                    <SunsetIcon />
                    <span>{`${copy.sunset} ${formatClock(clockOfIso(today.sunset), twelve, copy.isZh)}`}</span>
                  </span>
                )}
                {typeof uvVal === "number" && (
                  <span className="fuyu-weather__extra">
                    <span>{`${copy.uv} ${Math.round(uvVal)} ${uvLevel(uvVal, copy.isZh)}`}</span>
                  </span>
                )}
              </div>
            )}

            {forecast.hourly.length > 0 && (
              <div className="fuyu-weather__block">
                <span className="fuyu-weather__heading">{copy.hourly}</span>
                <div className={config.hours > 6 ? "fuyu-weather__hours is-scroll" : "fuyu-weather__hours"}>
                  {forecast.hourly.slice(0, config.hours).map((hour) => (
                    <div key={hour.time} className="fuyu-weather__hour" title={conditionLabel(hour.code, locale)}>
                      <span className="fuyu-weather__hour-time">
                        {formatClock(clockOfIso(hour.time), twelve, copy.isZh)}
                      </span>
                      <ConditionIcon kind={conditionKind(hour.code)} day={hour.day} tinted />
                      <span className="fuyu-weather__hour-temp">{formatTemp(hour.temp)}</span>
                      {config.showPop && hour.pop >= 30 && (
                        <span className="fuyu-weather__hour-pop">{`${Math.round(hour.pop)}%`}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {forecast.daily.length > 0 && (
              <div className="fuyu-weather__block">
                <span className="fuyu-weather__heading">{copy.daily}</span>
                <ul className="fuyu-weather__days">
                  {forecast.daily.map((day, idx) => {
                    const bar = tempRangeBar(day.min, day.max, weekMin, weekMax);
                    return (
                      <li key={day.date} className="fuyu-weather__day">
                        <span className="fuyu-weather__day-date">
                          {idx === 0 ? copy.today : copy.weekdays[weekdayOf(day.date)] ?? day.date.slice(5)}
                        </span>
                        <span className="fuyu-weather__day-icon">
                          <ConditionIcon kind={conditionKind(day.code)} tinted />
                        </span>
                        <span className="fuyu-weather__day-cond" title={conditionLabel(day.code, locale)}>
                          {conditionLabel(day.code, locale)}
                        </span>
                        {config.showPop && day.pop >= 30 && (
                          <span className="fuyu-weather__day-pop">{`${Math.round(day.pop)}%`}</span>
                        )}
                        <div className="fuyu-weather__day-range-wrap">
                          <span className="fuyu-weather__day-lo">{formatTemp(day.min)}</span>
                          <span className="fuyu-weather__bar-track" aria-hidden="true">
                            <span
                              className="fuyu-weather__bar-fill"
                              style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                            />
                          </span>
                          <span className="fuyu-weather__day-hi">{formatTemp(day.max)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}

        {(problem || error) && <p className="fuyu-weather__note">{problemText(problem, copy) ?? error}</p>}
        <span className="fuyu-weather__source">{copy.sourceNote}</span>
      </div>
    );
  }

  function WeatherCollapsed() {
    const { state } = useWeather(ctx);
    const { config } = state;
    const place = state.primaryPlace ?? state.place;
    const forecast = state.primaryForecast ?? state.forecast;
    if (!config.showOnBar || (config.cities.length === 0 && !config.city) || !forecast) return null;
    const locale = currentLocale();
    const short = conditionLabel(forecast.current.code, locale, true);
    const temp = formatTemp(forecast.current.temp);
    const title = place ? `${placeLine(place)} · ${short} ${temp}` : `${short} ${temp}`;
    return (
      <span className="fuyu-weather-bar" title={title}>
        {config.barStyle === "icon" && (
          <ConditionIcon kind={conditionKind(forecast.current.code)} day={forecast.current.day} size={13} tinted />
        )}
        {config.barStyle === "text" && (
          <>
            <span className="fuyu-weather-bar__notch-icon">
              <ConditionIcon kind={conditionKind(forecast.current.code)} day={forecast.current.day} size={13} tinted />
            </span>
            <span className="fuyu-weather-bar__cond">{short}</span>
          </>
        )}
        <span>{temp}</span>
      </span>
    );
  }

  function WeatherWidgetSlot({ width, height }: { width: number; height: number }) {
    const { state } = useWeather(ctx);
    return (
      <WeatherWidget
        state={state}
        width={width}
        height={height}
        onOpenPage={openPage}
        onOpenSettings={openSettings}
      />
    );
  }

  ctx.slots.add("island.page/v1", {
    id: PAGE_ID,
    title: PAGE_TITLE,
    component: WeatherPage,
    icon: WeatherIcon,
  });

  ctx.slots.add("island.collapsed/v1", {
    id: PAGE_ID,
    opens: PAGE_ID,
    component: WeatherCollapsed,
    hideable: true,
  });

  try {
    ctx.slots.add("island.widget/v1", {
      id: PAGE_ID,
      sizes: ["bar", "s", "m", "l", "w"],
      label: PAGE_TITLE,
      icon: WeatherIcon,
      component: WeatherWidgetSlot,
    });
  } catch (error) {
    console.info("[weather] this Fuyu cannot take panel widgets yet", error);
  }
}
