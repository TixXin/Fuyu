import { join } from "node:path";
import type { Context, HttpFetch, PluginSetupState } from "@fuyu/plugin-base";
import { messagesV1 } from "@fuyu/plugin-services";
import { EXTREME_QUIET_MS, extremeDecision } from "./alerts.ts";
import { MAX_CITIES, configFromStored, normalizeConfig, type SavedCity, type WeatherConfig } from "./config.ts";
import { clockOfIso, convertForecastUnits, formatClock, formatWind, systemUses12Hour, uses12Hour } from "./format.ts";
import { searchPlacesMulti } from "./geocoding.ts";
import { currentLocale } from "./locale.ts";
import { fetchAirQuality } from "./openMeteo.ts";
import { RAIN_QUIET_MS, RAINING_QUIET_MS, rainDecision } from "./rain.ts";
import { fetchWeatherWithFallback } from "./sources.ts";
import {
  loadCacheStore,
  lookupCityCache,
  placeToSaved,
  pruneCacheEntries,
  readJson,
  savedToPlace,
  writeJson,
  type CityCache,
} from "./store.ts";
import { SETUP_HINT, textFor } from "./text.ts";
import { METHODS, TOPICS, type WeatherForecast, type WeatherPlace, type WeatherProblem, type WeatherState } from "./types.ts";

export const name = "@fuyu/weather";
export const inject = {
  clients: null,
  commands: null,
  "messages/v1": null,
  http: { required: false },
  settings: { required: false },
};

const CONFIG_FILE = "config.json";
const CACHE_FILE = "cache.json";

type SetupApi = { settings?: { setup?: (state: PluginSetupState) => Promise<void> | void } };
type HttpApi = { http?: { fetch?: HttpFetch } };

function reportSetup(ctx: Context, state: PluginSetupState): void {
  try {
    void Promise.resolve((ctx as unknown as SetupApi).settings?.setup?.(state)).catch(() => {});
  } catch {
    return;
  }
}

function resolveFetcher(ctx: Context): HttpFetch {
  return (input, init) => {
    const httpFetch = (ctx as unknown as HttpApi).http?.fetch;
    return httpFetch ? httpFetch(input, init) : fetch(input, init);
  };
}

export function apply(ctx: Context) {
  const messages = ctx.services.get(messagesV1);
  const fetcher = resolveFetcher(ctx);

  let config = configFromStored(readJson<unknown>(join(ctx.dataDir, CONFIG_FILE)));
  const store = loadCacheStore(readJson<unknown>(join(ctx.dataDir, CACHE_FILE)));
  let loading = false;
  let problem: WeatherProblem | null = null;
  let stopTimer: (() => Promise<void>) | null = null;

  const primaryCity = (): SavedCity | null => config.cities[0] ?? null;
  const activeCity = (): SavedCity | null =>
    config.cities.find((item) => item.id === config.activeCityId) ?? primaryCity();

  const viewForecast = (hit: CityCache | null): WeatherForecast | null =>
    hit ? convertForecastUnits(hit.forecast, hit.units, config.units) : null;

  const snapshot = (): WeatherState => {
    const active = activeCity();
    const primary = primaryCity();
    const activeHit = lookupCityCache(store, active);
    const primaryHit = primary && active && primary.id === active.id ? activeHit : lookupCityCache(store, primary);
    return {
      config,
      activeCityId: active?.id ?? "",
      place: activeHit?.place ?? (active ? savedToPlace(active) : null),
      forecast: viewForecast(activeHit),
      aqi: config.showAqi ? activeHit?.aqi ?? null : null,
      fetchedAt: activeHit?.fetchedAt ?? null,
      primaryPlace: primaryHit?.place ?? (primary ? savedToPlace(primary) : null),
      primaryForecast: viewForecast(primaryHit),
      primaryAqi: config.showAqi ? primaryHit?.aqi ?? null : null,
      sourceUsed: activeHit?.sourceUsed ?? null,
      fallbackFrom: activeHit?.fallbackFrom ?? null,
      loading,
      problem: config.cities.length === 0 ? null : problem,
      updatedAt: Date.now(),
    };
  };

  const publish = () => ctx.clients.publish(TOPICS.state, snapshot());
  const saveConfigFile = () => writeJson(ctx.dataDir, CONFIG_FILE, config);
  const saveCacheFile = () => writeJson(ctx.dataDir, CACHE_FILE, store);

  const intervalMinutes = () =>
    config.rainAlert || config.extremeAlert ? Math.min(30, config.refreshMinutes) : config.refreshMinutes;

  const isFresh = (city: SavedCity): boolean => {
    const hit = lookupCityCache(store, city);
    if (!hit) return false;
    if (config.showAqi && !hit.aqi && (!hit.aqiFetchedAt || Date.now() - hit.aqiFetchedAt > 10 * 60_000)) {
      return false;
    }
    return Date.now() - hit.fetchedAt < (intervalMinutes() - 1) * 60_000;
  };

  async function maybeNotify(cityId: string, place: WeatherPlace, forecast: WeatherForecast): Promise<void> {
    const entry = store.entries[cityId];
    const primary = primaryCity();
    if (!entry || !primary || primary.id !== cityId) return;

    const copy = textFor(currentLocale());
    const now = Date.now();
    const twelve = uses12Hour(config.timeFormat, systemUses12Hour());

    const rain = rainDecision(forecast, config, now, entry.rainQuietUntil);
    if (rain.kind === "raining") {
      entry.rainQuietUntil = now + RAINING_QUIET_MS;
      saveCacheFile();
    } else if (rain.kind === "alert") {
      await messages.notify({
        source: name,
        pluginId: name,
        title: copy.rainTitle,
        body: copy.rainBody(place.name, formatClock(clockOfIso(rain.time), twelve, copy.isZh)),
        durationMs: 10_000,
      });
      entry.rainQuietUntil = now + RAIN_QUIET_MS;
      saveCacheFile();
    }

    const extreme = extremeDecision(forecast, config, now, entry.extremeQuietUntil);
    if (extreme.kind === "alert") {
      const label = copy.extremeLabels[extreme.hazard];
      const detail =
        extreme.hazard === "highWind" && typeof extreme.windKmh === "number"
          ? formatWind(extreme.windKmh, config.windUnit, copy.isZh)
          : undefined;
      const body = extreme.now
        ? copy.extremeNowBody(place.name, label, detail)
        : copy.extremeSoonBody(place.name, formatClock(clockOfIso(extreme.time), twelve, copy.isZh), label, detail);
      await messages.notify({
        source: name,
        pluginId: name,
        title: copy.extremeTitle,
        body,
        durationMs: 12_000,
      });
      entry.extremeQuietUntil = { ...(entry.extremeQuietUntil ?? {}), [extreme.hazard]: now + EXTREME_QUIET_MS };
      saveCacheFile();
    }
  }

  function hydrateCityMeta(city: SavedCity, place: WeatherPlace, nmcStationId?: string): SavedCity {
    const merged: WeatherPlace = nmcStationId ? { ...place, nmcStationId } : place;
    const needsUpgrade = city.latitude === null || city.longitude === null;
    const needsStation = Boolean(nmcStationId && city.nmcStationId !== nmcStationId);
    if (!needsUpgrade && !needsStation) return city;
    const upgraded = placeToSaved(merged, city.query);
    const oldId = city.id;
    const nextCities = config.cities.map((item) => (item.id === oldId ? upgraded : item));
    const nextActive = config.activeCityId === oldId ? upgraded.id : config.activeCityId;
    config = normalizeConfig({ cities: nextCities, activeCityId: nextActive }, config);
    if (oldId !== upgraded.id && store.entries[oldId] && !store.entries[upgraded.id]) {
      store.entries[upgraded.id] = store.entries[oldId];
      delete store.entries[oldId];
    }
    saveConfigFile();
    return upgraded;
  }

  async function updateCity(target: SavedCity | null, force: boolean): Promise<WeatherState> {
    if (!target) {
      problem = null;
      loading = false;
      publish();
      return snapshot();
    }
    if (!force && isFresh(target)) {
      publish();
      return snapshot();
    }
    loading = true;
    publish();
    try {
      const existing = lookupCityCache(store, target);
      const knownPlace = savedToPlace(target) ?? existing?.place ?? null;
      const found = knownPlace ?? (await searchPlacesMulti(target.query, fetcher))[0] ?? null;
      if (!found) {
        problem = { kind: "noPlace", city: target.query };
        loading = false;
        return snapshot();
      }
      const result = await fetchWeatherWithFallback(
        found,
        config.units,
        config.weatherSource,
        config.autoFallback,
        fetcher,
      );
      const resolved = hydrateCityMeta(target, found, result.nmcStationId);
      const place = result.nmcStationId ? { ...found, nmcStationId: result.nmcStationId } : found;
      let aqi = result.nmcAqi ?? existing?.aqi ?? null;
      let aqiFetchedAt = existing?.aqiFetchedAt;
      if (config.showAqi) {
        try {
          const fetchedAqi = await fetchAirQuality(place, fetcher);
          if (fetchedAqi) aqi = fetchedAqi;
          aqiFetchedAt = Date.now();
        } catch {
          aqiFetchedAt = Date.now();
        }
      }
      store.entries[resolved.id] = {
        city: resolved.query,
        units: config.units,
        place,
        forecast: result.forecast,
        sourceUsed: result.sourceUsed,
        fallbackFrom: result.fallbackFrom,
        aqi,
        aqiFetchedAt,
        fetchedAt: Date.now(),
        rainQuietUntil: existing?.rainQuietUntil,
        extremeQuietUntil: existing?.extremeQuietUntil,
      };
      problem = null;
      saveCacheFile();
      await maybeNotify(resolved.id, place, result.forecast);
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
    if (config.cities.length === 0) return;
    stopTimer = ctx.setInterval(() => {
      void updateCity(primaryCity(), false);
    }, intervalMinutes() * 60_000);
  }

  const reportCity = () => reportSetup(ctx, { needed: config.cities.length === 0, hint: SETUP_HINT });

  syncSchedule();
  reportCity();
  if (config.cities.length > 0) void updateCity(activeCity(), false);

  async function setConfig(patch: Partial<WeatherConfig> | undefined): Promise<WeatherState> {
    const prev = config;
    config = normalizeConfig((patch ?? {}) as Record<string, unknown>, config);
    saveConfigFile();
    reportCity();

    const prevPrimary = prev.cities[0]?.id ?? "";
    const nextPrimary = config.cities[0]?.id ?? "";
    if (
      config.refreshMinutes !== prev.refreshMinutes ||
      config.rainAlert !== prev.rainAlert ||
      config.extremeAlert !== prev.extremeAlert ||
      nextPrimary !== prevPrimary
    ) {
      syncSchedule();
    }
    if (config.cities.length === 0) {
      problem = null;
      if (pruneCacheEntries(store, config.cities)) saveCacheFile();
      publish();
      return snapshot();
    }
    const target = activeCity();
    const hit = lookupCityCache(store, target);
    const sourceChanged =
      config.weatherSource !== prev.weatherSource || config.autoFallback !== prev.autoFallback;
    if (config.units !== prev.units && hit && !sourceChanged) {
      hit.forecast = convertForecastUnits(hit.forecast, hit.units, config.units);
      hit.units = config.units;
      saveCacheFile();
      publish();
      return snapshot();
    }
    const needFetch =
      sourceChanged ||
      nextPrimary !== prevPrimary ||
      config.activeCityId !== prev.activeCityId ||
      (config.showAqi && !prev.showAqi) ||
      !hit;
    if (needFetch) return updateCity(target, true);
    publish();
    return snapshot();
  }

  async function addCity(place: WeatherPlace | undefined): Promise<WeatherState> {
    if (!place || typeof place.latitude !== "number" || typeof place.longitude !== "number") return snapshot();
    const entry = placeToSaved(place);
    const existing = config.cities.find((item) => item.id === entry.id);
    if (existing) {
      config = normalizeConfig({ activeCityId: existing.id }, config);
      saveConfigFile();
      return updateCity(existing, false);
    }
    if (config.cities.length >= MAX_CITIES) return snapshot();
    config = normalizeConfig({ cities: [...config.cities, entry], activeCityId: entry.id }, config);
    saveConfigFile();
    reportCity();
    syncSchedule();
    return updateCity(entry, true);
  }

  async function removeCity(id: string | undefined): Promise<WeatherState> {
    if (!id) return snapshot();
    config = normalizeConfig({ cities: config.cities.filter((item) => item.id !== id) }, config);
    saveConfigFile();
    if (pruneCacheEntries(store, config.cities)) saveCacheFile();
    reportCity();
    syncSchedule();
    if (config.cities.length === 0) {
      problem = null;
      publish();
      return snapshot();
    }
    const target = activeCity();
    if (target && !lookupCityCache(store, target)) return updateCity(target, true);
    publish();
    return snapshot();
  }

  async function setPrimaryCity(id: string | undefined): Promise<WeatherState> {
    if (!id) return snapshot();
    const picked = config.cities.find((item) => item.id === id);
    if (!picked) return snapshot();
    config = normalizeConfig({ cities: [picked, ...config.cities.filter((item) => item.id !== id)] }, config);
    saveConfigFile();
    syncSchedule();
    if (!lookupCityCache(store, picked)) return updateCity(picked, true);
    publish();
    return snapshot();
  }

  async function selectCity(id: string | undefined): Promise<WeatherState> {
    if (!id) return snapshot();
    const picked = config.cities.find((item) => item.id === id);
    if (!picked) return snapshot();
    config = normalizeConfig({ activeCityId: picked.id }, config);
    saveConfigFile();
    if (!isFresh(picked)) return updateCity(picked, false);
    publish();
    return snapshot();
  }

  async function refreshAll(): Promise<WeatherState> {
    const active = activeCity();
    const primary = primaryCity();
    if (primary && active && primary.id !== active.id) await updateCity(primary, true);
    return updateCity(active, true);
  }

  ctx.clients.handle(METHODS.getState, async () => snapshot());
  ctx.clients.handle(METHODS.setConfig, async (params?: Partial<WeatherConfig>) => setConfig(params));
  ctx.clients.handle(METHODS.refresh, async () => refreshAll());
  ctx.clients.handle(METHODS.searchCities, async (params?: { query?: string }) => ({
    results: await searchPlacesMulti(String(params?.query ?? ""), fetcher),
  }));
  ctx.clients.handle(METHODS.addCity, async (params?: { place?: WeatherPlace }) => addCity(params?.place));
  ctx.clients.handle(METHODS.removeCity, async (params?: { id?: string }) => removeCity(params?.id));
  ctx.clients.handle(METHODS.setPrimaryCity, async (params?: { id?: string }) => setPrimaryCity(params?.id));
  ctx.clients.handle(METHODS.selectCity, async (params?: { id?: string }) => selectCity(params?.id));

  ctx.commands.register("refresh", () => refreshAll(), {
    title: { "zh-CN": "立即刷新天气", en: "Refresh weather now" },
  });
}
