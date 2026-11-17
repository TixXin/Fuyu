import type { Context } from "@fuyu/plugin-base";
import { TEXT, conditionLabel, formatTemp } from "./types.ts";
import { useWeather } from "./useWeather.ts";
import "./styles.css";

function WeatherIcon({ size = 16 }: { size?: number | string }) {
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
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}

export default function apply(ctx: Context) {
  function WeatherPage() {
    const { state, locale, error, refresh } = useWeather(ctx);
    const copy = TEXT[locale];
    const { config, place, forecast, loading, problem } = state;

    if (!config.city.trim()) {
      return (
        <div className="fuyu-weather">
          <div className="fuyu-weather__empty">
            <strong className="fuyu-weather__title">{copy.emptyTitle}</strong>
            <p className="fuyu-weather__note">{copy.emptyBody}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="fuyu-weather">
        <div className="fuyu-weather__top">
          <div className="fuyu-weather__place-wrap">
            <h3 className="fuyu-weather__title">{place?.name ?? config.city}</h3>
            {place?.region && <span className="fuyu-weather__sub">{place.region}</span>}
          </div>
          <button
            type="button"
            className="fuyu-weather__button"
            disabled={loading}
            onClick={refresh}
          >
            {loading ? copy.loading : copy.refresh}
          </button>
        </div>

        {forecast && (
          <>
            <div className="fuyu-weather__hero">
              <span className="fuyu-weather__temp">{formatTemp(forecast.current.temp)}</span>
              <div className="fuyu-weather__hero-meta">
                <span className="fuyu-weather__cond">
                  {conditionLabel(forecast.current.code, locale)}
                </span>
                <span className="fuyu-weather__stats">
                  {`${copy.feels} ${formatTemp(forecast.current.feels)} · ${copy.humidity} ${Math.round(forecast.current.humidity)}% · ${copy.wind} ${Math.round(forecast.current.wind)} km/h`}
                </span>
              </div>
            </div>

            {forecast.hourly.length > 0 && (
              <div className="fuyu-weather__block">
                <span className="fuyu-weather__heading">{copy.hourly}</span>
                <div className="fuyu-weather__hours">
                  {forecast.hourly.slice(0, 6).map((hour) => (
                    <div key={hour.time} className="fuyu-weather__hour">
                      <span className="fuyu-weather__hour-time">{hour.time.slice(11, 16)}</span>
                      <span className="fuyu-weather__hour-cond">
                        {conditionLabel(hour.code, locale, true)}
                      </span>
                      <span className="fuyu-weather__hour-temp">{formatTemp(hour.temp)}</span>
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
                        {idx === 0 ? copy.today : day.date.slice(5)}
                      </span>
                      <span className="fuyu-weather__day-cond">
                        {conditionLabel(day.code, locale)}
                      </span>
                      <span className="fuyu-weather__day-range">
                        {`${formatTemp(day.min)} / ${formatTemp(day.max)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {(problem || error) && <p className="fuyu-weather__note">{problem ?? error}</p>}
        <span className="fuyu-weather__source">{copy.sourceNote}</span>
      </div>
    );
  }

  function WeatherCollapsed() {
    const { state, locale } = useWeather(ctx);
    const { config, place, forecast } = state;
    if (!config.showOnBar || !config.city.trim() || !forecast) {
      return null;
    }
    const short = conditionLabel(forecast.current.code, locale, true);
    const temp = formatTemp(forecast.current.temp);
    const title = place ? `${place.name} · ${short} ${temp}` : `${short} ${temp}`;
    return (
      <span className="fuyu-weather-bar" title={title}>
        {`${short} ${temp}`}
      </span>
    );
  }

  ctx.slots.add("island.page/v1", {
    id: "@fuyu/weather",
    component: WeatherPage,
    icon: WeatherIcon,
  });

  ctx.slots.add("island.collapsed/v1", {
    id: "@fuyu/weather",
    component: WeatherCollapsed,
    hideable: true,
  });
}
