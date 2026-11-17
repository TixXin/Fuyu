import type { Context } from "@fuyu/plugin-base";
import { useEffect, useState } from "react";
import { TEXT, type TemperatureUnit } from "./types.ts";
import { useWeather } from "./useWeather.ts";
import "./styles.css";

export default function apply(ctx: Context) {
  function WeatherSection() {
    const { state, locale, error, saveConfig, refresh } = useWeather(ctx);
    const copy = TEXT[locale];

    const [city, setCity] = useState(state.config.city);
    const [units, setUnits] = useState<TemperatureUnit>(state.config.units);
    const [showOnBar, setShowOnBar] = useState(state.config.showOnBar);
    const [rainAlert, setRainAlert] = useState(state.config.rainAlert);
    const [minutes, setMinutes] = useState(String(state.config.refreshMinutes));

    useEffect(() => {
      setCity(state.config.city);
      setUnits(state.config.units);
      setShowOnBar(state.config.showOnBar);
      setRainAlert(state.config.rainAlert);
      setMinutes(String(state.config.refreshMinutes));
    }, [
      state.config.city,
      state.config.units,
      state.config.showOnBar,
      state.config.rainAlert,
      state.config.refreshMinutes,
    ]);

    const onSave = () => {
      void saveConfig({
        city: city.trim(),
        units,
        showOnBar,
        rainAlert,
        refreshMinutes: Number(minutes) || 30,
      });
    };

    return (
      <section className="fuyu-weather-settings">
        <h3 className="fuyu-weather__title">{copy.title}</h3>

        <label className="fuyu-weather-settings__field">
          <span className="fuyu-weather-settings__label">{copy.cityLabel}</span>
          <input
            type="text"
            className="fuyu-weather-settings__input"
            value={city}
            placeholder={copy.cityPlaceholder}
            onChange={(event) => setCity(event.target.value)}
          />
        </label>

        <div className="fuyu-weather-settings__grid">
          <label className="fuyu-weather-settings__field">
            <span className="fuyu-weather-settings__label">{copy.unitsLabel}</span>
            <select
              className="fuyu-weather-settings__input"
              value={units}
              onChange={(event) => setUnits(event.target.value as TemperatureUnit)}
            >
              <option value="celsius">{copy.celsius}</option>
              <option value="fahrenheit">{copy.fahrenheit}</option>
            </select>
          </label>

          <label className="fuyu-weather-settings__field">
            <span className="fuyu-weather-settings__label">{copy.refreshMinutes}</span>
            <input
              type="number"
              min={30}
              max={180}
              className="fuyu-weather-settings__input"
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
          </label>
        </div>

        <label className="fuyu-weather-settings__check">
          <span>{copy.showOnBar}</span>
          <input
            type="checkbox"
            checked={showOnBar}
            onChange={(event) => setShowOnBar(event.target.checked)}
          />
        </label>

        <label className="fuyu-weather-settings__check">
          <span>{copy.rainAlert}</span>
          <input
            type="checkbox"
            checked={rainAlert}
            onChange={(event) => setRainAlert(event.target.checked)}
          />
        </label>

        <div className="fuyu-weather-settings__actions">
          <button type="button" className="fuyu-weather__button" onClick={onSave}>
            {copy.save}
          </button>
          <button
            type="button"
            className="fuyu-weather__button fuyu-weather__button--secondary"
            disabled={!state.config.city.trim() || state.loading}
            onClick={refresh}
          >
            {copy.refresh}
          </button>
        </div>

        {(state.problem || error) && (
          <p className="fuyu-weather__note">{state.problem ?? error}</p>
        )}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", {
    id: "@fuyu/weather",
    category: "pluginsV3",
    component: WeatherSection,
  });
}
