import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import { messagesV1 } from "@fuyu/plugin-services";
import { fetchForecast, findPlace } from "./openMeteo.ts";
import {
  DEFAULT_CONFIG,
  METHODS,
  TEXT,
  TOPICS,
  type Locale,
  type TemperatureUnit,
  type WeatherConfig,
  type WeatherForecast,
  type WeatherPlace,
  type WeatherState,
} from "./types.ts";

export const name = "@fuyu/weather";
export const inject = ["clients", "messages/v1"];

const CONFIG_FILE = "config.json";
const CACHE_FILE = "cache.json";
const RAIN_MM = 0.1;
const RAIN_QUIET_MS = 3 * 60 * 60 * 1000;

interface StoredCache {
  city: string;
  units: TemperatureUnit;
  locale: Locale;
  place: WeatherPlace;
  forecast: WeatherForecast;
  fetchedAt: number;
  rainQuietUntil?: number;
}

function normalizeLocale(value: unknown): Locale {
  return value === "en" ? "en" : "zh-CN";
}

function normalizeUnits(value: unknown): TemperatureUnit {
  return value === "fahrenheit" ? "fahrenheit" : "celsius";
}

function normalizeMinutes(value: unknown): number {
  const n = typeof value === "number" ? Math.round(value) : Number(value);
  if (!Number.isFinite(n)) return 30;
  return Math.max(30, Math.min(180, n));
}

function readJson<T>(file: string): T | null {
  try {
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJson(dir: string, filename: string, value: unknown): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function loadConfig(dir: string): WeatherConfig {
  const raw = readJson<Partial<WeatherConfig>>(join(dir, CONFIG_FILE));
  if (!raw) return { ...DEFAULT_CONFIG };
  return {
    city: typeof raw.city === "string" ? raw.city.trim() : "",
    units: normalizeUnits(raw.units),
    showOnBar: typeof raw.showOnBar === "boolean" ? raw.showOnBar : DEFAULT_CONFIG.showOnBar,
    rainAlert: typeof raw.rainAlert === "boolean" ? raw.rainAlert : DEFAULT_CONFIG.rainAlert,
    refreshMinutes: normalizeMinutes(raw.refreshMinutes),
    locale: normalizeLocale(raw.locale),
  };
}

export function apply(ctx: Context) {
  const messages = ctx.services.get(messagesV1);

  let config = loadConfig(ctx.dataDir);
  let cache = readJson<StoredCache>(join(ctx.dataDir, CACHE_FILE));
  let loading = false;
  let problem: string | null = null;
  let stopTimer: (() => Promise<void>) | null = null;

  const cacheMatches = (): boolean =>
    Boolean(
      cache &&
        config.city.trim() !== "" &&
        cache.city === config.city.trim() &&
        cache.units === config.units,
    );

  const snapshot = (): WeatherState => ({
    config,
    place: cacheMatches() ? cache!.place : null,
    forecast: cacheMatches() ? cache!.forecast : null,
    fetchedAt: cacheMatches() ? cache!.fetchedAt : null,
    loading,
    problem: config.city.trim() === "" ? null : problem,
    updatedAt: Date.now(),
  });

  const publish = () => ctx.clients.publish(TOPICS.state, snapshot());

  const isFresh = (): boolean => {
    if (!cacheMatches() || !cache) return false;
    const limitMinutes = config.rainAlert ? Math.min(30, config.refreshMinutes) : config.refreshMinutes;
    return Date.now() - cache.fetchedAt < (limitMinutes - 1) * 60_000;
  };

  async function maybeNotifyRain(place: WeatherPlace, forecast: WeatherForecast): Promise<void> {
    if (!config.rainAlert || !cache) return;
    const now = Date.now();
    if (forecast.current.mm >= RAIN_MM) {
      cache.rainQuietUntil = now + 60 * 60_000;
      writeJson(ctx.dataDir, CACHE_FILE, cache);
      return;
    }
    if (typeof cache.rainQuietUntil === "number" && cache.rainQuietUntil > now) return;
    const upcoming = forecast.soon.find((slot) => slot.mm >= RAIN_MM);
    if (!upcoming) return;
    const clock = upcoming.time.length >= 16 ? upcoming.time.slice(11, 16) : upcoming.time;
    const copy = TEXT[config.locale];
    await messages.notify({
      source: name,
      pluginId: name,
      title: copy.rainTitle,
      body: copy.rainBody(place.name, clock),
      durationMs: 10_000,
    });
    cache.rainQuietUntil = now + RAIN_QUIET_MS;
    writeJson(ctx.dataDir, CACHE_FILE, cache);
  }

  async function updateWeather(force: boolean): Promise<WeatherState> {
    const city = config.city.trim();
    if (!city) {
      problem = null;
      loading = false;
      publish();
      return snapshot();
    }
    if (!force && isFresh()) {
      publish();
      return snapshot();
    }
    loading = true;
    publish();
    try {
      const reusePlace =
        cache && cache.city === city && cache.locale === config.locale ? cache.place : null;
      const place = reusePlace ?? (await findPlace(city, config.locale));
      if (!place) {
        problem = TEXT[config.locale].noPlace(city);
        loading = false;
        publish();
        return snapshot();
      }
      const forecast = await fetchForecast(place, config.units);
      cache = {
        city,
        units: config.units,
        locale: config.locale,
        place,
        forecast,
        fetchedAt: Date.now(),
        rainQuietUntil: cache?.rainQuietUntil,
      };
      problem = null;
      writeJson(ctx.dataDir, CACHE_FILE, cache);
      await maybeNotifyRain(place, forecast);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      problem = TEXT[config.locale].offline(reason);
    } finally {
      loading = false;
      publish();
    }
    return snapshot();
  }

  function syncSchedule() {
    if (stopTimer) {
      void stopTimer();
      stopTimer = null;
    }
    if (config.city.trim() === "") return;
    const intervalMinutes = config.rainAlert ? Math.min(30, config.refreshMinutes) : config.refreshMinutes;
    stopTimer = ctx.setInterval(() => {
      void updateWeather(false);
    }, intervalMinutes * 60_000);
  }

  syncSchedule();
  if (config.city.trim() !== "") {
    void updateWeather(false);
  }

  ctx.clients.handle(METHODS.getState, async (params?: { locale?: Locale }) => {
    if (params?.locale && params.locale !== config.locale) {
      config = { ...config, locale: normalizeLocale(params.locale) };
      writeJson(ctx.dataDir, CONFIG_FILE, config);
    }
    return snapshot();
  });

  ctx.clients.handle(METHODS.setConfig, async (params?: Partial<WeatherConfig>) => {
    const prevCity = config.city;
    const prevUnits = config.units;
    config = {
      city: typeof params?.city === "string" ? params.city.trim() : config.city,
      units: params?.units ? normalizeUnits(params.units) : config.units,
      showOnBar: typeof params?.showOnBar === "boolean" ? params.showOnBar : config.showOnBar,
      rainAlert: typeof params?.rainAlert === "boolean" ? params.rainAlert : config.rainAlert,
      refreshMinutes:
        params?.refreshMinutes !== undefined ? normalizeMinutes(params.refreshMinutes) : config.refreshMinutes,
      locale: params?.locale ? normalizeLocale(params.locale) : config.locale,
    };
    writeJson(ctx.dataDir, CONFIG_FILE, config);
    syncSchedule();
    if (config.city === "") {
      problem = null;
      publish();
      return snapshot();
    }
    if (config.city !== prevCity || config.units !== prevUnits || !cacheMatches()) {
      return updateWeather(true);
    }
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.refresh, async (params?: { locale?: Locale }) => {
    if (params?.locale && params.locale !== config.locale) {
      config = { ...config, locale: normalizeLocale(params.locale) };
      writeJson(ctx.dataDir, CONFIG_FILE, config);
    }
    return updateWeather(true);
  });
}
