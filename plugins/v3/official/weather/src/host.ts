import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context, PluginSetupState } from "@fuyu/plugin-base";
import { messagesV1 } from "@fuyu/plugin-services";
import { configFromStored, normalizeConfig, type TemperatureUnit, type WeatherConfig } from "./config.ts";
import { clockOfIso, formatClock, systemUses12Hour, uses12Hour } from "./format.ts";
import { currentLocale } from "./locale.ts";
import { fetchForecast, findPlace } from "./openMeteo.ts";
import { RAIN_QUIET_MS, RAINING_QUIET_MS, rainDecision } from "./rain.ts";
import { SETUP_HINT, textFor } from "./text.ts";
import { METHODS, TOPICS, type WeatherForecast, type WeatherPlace, type WeatherProblem, type WeatherState } from "./types.ts";

export const name = "@fuyu/weather";
export const inject = { clients: null, commands: null, "messages/v1": null, settings: { required: false } };

const CONFIG_FILE = "config.json";
const CACHE_FILE = "cache.json";
const FULL_HOURS = 24;

interface StoredCache {
  city: string;
  units: TemperatureUnit;
  place: WeatherPlace;
  forecast: WeatherForecast;
  fetchedAt: number;
  rainQuietUntil?: number;
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

type SetupApi = { settings?: { setup?: (state: PluginSetupState) => Promise<void> | void } };

function reportSetup(ctx: Context, state: PluginSetupState): void {
  try {
    void Promise.resolve((ctx as unknown as SetupApi).settings?.setup?.(state)).catch(() => {});
  } catch {
    return;
  }
}

export function apply(ctx: Context) {
  const messages = ctx.services.get(messagesV1);
  const copy = textFor(currentLocale());

  let config = configFromStored(readJson<unknown>(join(ctx.dataDir, CONFIG_FILE)));
  let cache = readJson<StoredCache>(join(ctx.dataDir, CACHE_FILE));
  let loading = false;
  let problem: WeatherProblem | null = null;
  let stopTimer: (() => Promise<void>) | null = null;

  const cacheMatches = (): boolean =>
    Boolean(cache && config.city !== "" && cache.city === config.city && cache.units === config.units);

  const snapshot = (): WeatherState => {
    const hit = cacheMatches() && cache ? cache : null;
    return {
      config,
      place: hit?.place ?? null,
      forecast: hit?.forecast ?? null,
      fetchedAt: hit?.fetchedAt ?? null,
      loading,
      problem: config.city === "" ? null : problem,
      updatedAt: Date.now(),
    };
  };

  const publish = () => ctx.clients.publish(TOPICS.state, snapshot());

  const intervalMinutes = () => (config.rainAlert ? Math.min(30, config.refreshMinutes) : config.refreshMinutes);

  const isFresh = (): boolean => {
    if (!cacheMatches() || !cache) return false;
    if (cache.forecast.hourly.length < FULL_HOURS) return false;
    return Date.now() - cache.fetchedAt < (intervalMinutes() - 1) * 60_000;
  };

  async function maybeNotifyRain(place: WeatherPlace, forecast: WeatherForecast): Promise<void> {
    if (!cache) return;
    const now = Date.now();
    const decision = rainDecision(forecast, config, now, cache.rainQuietUntil);
    if (decision.kind === "raining") {
      cache.rainQuietUntil = now + RAINING_QUIET_MS;
      writeJson(ctx.dataDir, CACHE_FILE, cache);
      return;
    }
    if (decision.kind !== "alert") return;
    const twelve = uses12Hour(config.timeFormat, systemUses12Hour());
    await messages.notify({
      source: name,
      pluginId: name,
      title: copy.rainTitle,
      body: copy.rainBody(place.name, formatClock(clockOfIso(decision.time), twelve, copy.isZh)),
      durationMs: 10_000,
    });
    cache.rainQuietUntil = now + RAIN_QUIET_MS;
    writeJson(ctx.dataDir, CACHE_FILE, cache);
  }

  async function updateWeather(force: boolean): Promise<WeatherState> {
    const city = config.city;
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
      const reusePlace = cache && cache.city === city ? cache.place : null;
      const place = reusePlace ?? (await findPlace(city));
      if (!place) {
        problem = { kind: "noPlace", city };
        loading = false;
        return snapshot();
      }
      const forecast = await fetchForecast(place, config.units);
      cache = {
        city,
        units: config.units,
        place,
        forecast,
        fetchedAt: Date.now(),
        rainQuietUntil: cache?.rainQuietUntil,
      };
      problem = null;
      writeJson(ctx.dataDir, CACHE_FILE, cache);
      await maybeNotifyRain(place, forecast);
    } catch (error) {
      problem = { kind: "offline", reason: error instanceof Error ? error.message : String(error) };
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
    if (config.city === "") return;
    stopTimer = ctx.setInterval(() => {
      void updateWeather(false);
    }, intervalMinutes() * 60_000);
  }

  const reportCity = () => reportSetup(ctx, { needed: config.city === "", hint: SETUP_HINT });

  syncSchedule();
  reportCity();
  if (config.city !== "") void updateWeather(false);

  async function setConfig(patch: Partial<WeatherConfig> | undefined): Promise<WeatherState> {
    const prev = config;
    config = normalizeConfig((patch ?? {}) as Record<string, unknown>, config);
    writeJson(ctx.dataDir, CONFIG_FILE, config);
    reportCity();
    if (config.refreshMinutes !== prev.refreshMinutes || config.rainAlert !== prev.rainAlert || config.city !== prev.city) {
      syncSchedule();
    }
    if (config.city === "") {
      problem = null;
      publish();
      return snapshot();
    }
    if (config.city !== prev.city || config.units !== prev.units || !cacheMatches()) {
      return updateWeather(true);
    }
    publish();
    return snapshot();
  }

  ctx.clients.handle(METHODS.getState, async () => snapshot());
  ctx.clients.handle(METHODS.setConfig, async (params?: Partial<WeatherConfig>) => setConfig(params));
  ctx.clients.handle(METHODS.refresh, async () => updateWeather(true));

  ctx.commands.register("refresh", () => updateWeather(true), {
    title: { "zh-CN": "立即刷新天气", en: "Refresh weather now" },
  });
}
