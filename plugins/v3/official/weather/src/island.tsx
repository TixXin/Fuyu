import type { Context } from "@fuyu/plugin-base";
import { conditionKind, conditionLabel } from "./conditions.ts";
import { clockOfIso, clockOfMs, formatClock, formatWind, sameLocalDay, systemUses12Hour, uses12Hour, weekdayOf } from "./format.ts";
import { ConditionIcon, RefreshIcon, WeatherIcon } from "./icons.tsx";
import { currentLocale } from "./locale.ts";
import { PAGE_TITLE, problemText, textFor } from "./text.ts";
import { formatTemp, type WeatherForecast, type WeatherState } from "./types.ts";
import { useWeather } from "./useWeather.ts";
import "./styles.css";

const PAGE_ID = "@fuyu/weather";
const SYSTEM_12 = systemUses12Hour();

type SettingsOpener = { settings?: { open?: () => unknown } };

function settingsOpener(ctx: Context): (() => unknown) | null {
  const holder = (ctx as unknown as SettingsOpener).settings;
  const open = holder?.open;
  return typeof open === "function" ? () => open.call(holder) : null;
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

  function WeatherPage() {
    const { state, error, refresh } = useWeather(ctx);
    const locale = currentLocale();
    const copy = textFor(locale);
    const { config, place, forecast, loading, problem, fetchedAt } = state;
    const twelve = uses12Hour(config.timeFormat, SYSTEM_12);

    if (!config.city) {
      return (
        <div className="fuyu-weather">
          <div className="fuyu-weather__empty">
            <strong className="fuyu-weather__title">{copy.emptyTitle}</strong>
            <p className="fuyu-weather__note">{openSettings ? copy.emptyBody : copy.emptyNoButton}</p>
            {openSettings && (
              <button type="button" className="fuyu-weather__button" onClick={() => void openSettings()}>
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

    return (
      <div className="fuyu-weather">
        <div className="fuyu-weather__top">
          <div className="fuyu-weather__place-wrap">
            <h3 className="fuyu-weather__title">{place?.name ?? config.city}</h3>
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
                <ConditionIcon kind={conditionKind(forecast.current.code)} day={forecast.current.day} size={28} />
              </span>
              <span className="fuyu-weather__temp">{formatTemp(forecast.current.temp)}</span>
              <div className="fuyu-weather__hero-meta">
                <span className="fuyu-weather__cond">{conditionLabel(forecast.current.code, locale)}</span>
                {stats && <span className="fuyu-weather__stats">{stats}</span>}
              </div>
            </div>

            {forecast.hourly.length > 0 && (
              <div className="fuyu-weather__block">
                <span className="fuyu-weather__heading">{copy.hourly}</span>
                <div className={config.hours > 6 ? "fuyu-weather__hours is-scroll" : "fuyu-weather__hours"}>
                  {forecast.hourly.slice(0, config.hours).map((hour) => (
                    <div key={hour.time} className="fuyu-weather__hour" title={conditionLabel(hour.code, locale)}>
                      <span className="fuyu-weather__hour-time">{formatClock(clockOfIso(hour.time), twelve, copy.isZh)}</span>
                      <ConditionIcon kind={conditionKind(hour.code)} day={hour.day} />
                      <span className="fuyu-weather__hour-temp">{formatTemp(hour.temp)}</span>
                      {config.showPop && hour.pop >= 30 && <span className="fuyu-weather__hour-pop">{`${Math.round(hour.pop)}%`}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {forecast.daily.length > 0 && (
              <div className="fuyu-weather__block">
                <span className="fuyu-weather__heading">{copy.daily}</span>
                <ul className="fuyu-weather__days">
                  {forecast.daily.map((day, idx) => (
                    <li key={day.date} className="fuyu-weather__day">
                      <span className="fuyu-weather__day-date">
                        {idx === 0 ? copy.today : copy.weekdays[weekdayOf(day.date)] ?? day.date.slice(5)}
                      </span>
                      <span className="fuyu-weather__day-icon">
                        <ConditionIcon kind={conditionKind(day.code)} />
                      </span>
                      <span className="fuyu-weather__day-cond">{conditionLabel(day.code, locale)}</span>
                      {config.showPop && day.pop >= 30 && <span className="fuyu-weather__day-pop">{`${Math.round(day.pop)}%`}</span>}
                      <span className="fuyu-weather__day-range">{`${formatTemp(day.min)} / ${formatTemp(day.max)}`}</span>
                    </li>
                  ))}
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
    const { config, place, forecast } = state;
    if (!config.showOnBar || !config.city || !forecast) return null;
    const locale = currentLocale();
    const short = conditionLabel(forecast.current.code, locale, true);
    const temp = formatTemp(forecast.current.temp);
    const title = place ? `${place.name} · ${short} ${temp}` : `${short} ${temp}`;
    return (
      <span className="fuyu-weather-bar" title={title}>
        {config.barStyle === "icon" && <ConditionIcon kind={conditionKind(forecast.current.code)} day={forecast.current.day} size={13} />}
        {config.barStyle === "text" && <span className="fuyu-weather-bar__cond">{short}</span>}
        <span>{temp}</span>
      </span>
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
}
