import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtremeQuietMap } from "./alerts.ts";
import { coordsId, type SavedCity, type TemperatureUnit } from "./config.ts";
import type { WeatherAirQuality, WeatherForecast, WeatherPlace } from "./types.ts";

export interface CityCache {
  city: string;
  units: TemperatureUnit;
  place: WeatherPlace;
  forecast: WeatherForecast;
  aqi?: WeatherAirQuality | null;
  aqiFetchedAt?: number;
  fetchedAt: number;
  rainQuietUntil?: number;
  extremeQuietUntil?: ExtremeQuietMap;
}

export interface CacheStore {
  version: 2;
  entries: Record<string, CityCache>;
}

export function readJson<T>(file: string): T | null {
  try {
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export function writeJson(dir: string, filename: string, value: unknown): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function loadCacheStore(raw: unknown): CacheStore {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { version: 2, entries: {} };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.version === 2 && obj.entries && typeof obj.entries === "object" && !Array.isArray(obj.entries)) {
    return { version: 2, entries: { ...(obj.entries as Record<string, CityCache>) } };
  }
  if (typeof obj.city === "string" && obj.place && obj.forecast && typeof obj.fetchedAt === "number") {
    const legacy = obj as unknown as CityCache;
    const entries: Record<string, CityCache> = {};
    const queryKey = `query:${legacy.city.trim().toLowerCase()}`;
    entries[queryKey] = legacy;
    if (typeof legacy.place.latitude === "number" && typeof legacy.place.longitude === "number") {
      entries[coordsId(legacy.place.latitude, legacy.place.longitude)] = legacy;
    }
    return { version: 2, entries };
  }
  return { version: 2, entries: {} };
}

export function placeToSaved(place: WeatherPlace, query?: string): SavedCity {
  const id = place.id || coordsId(place.latitude, place.longitude);
  return {
    id,
    query: query?.trim() || place.name,
    name: place.name,
    region: place.region,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

export function savedToPlace(city: SavedCity): WeatherPlace | null {
  if (city.latitude === null || city.longitude === null) return null;
  return {
    id: city.id,
    name: city.name,
    region: city.region,
    country: city.country,
    latitude: city.latitude,
    longitude: city.longitude,
  };
}

export function lookupCityCache(store: CacheStore, city: SavedCity | null): CityCache | null {
  if (!city) return null;
  const direct = store.entries[city.id];
  if (direct) return direct;
  if (city.latitude !== null && city.longitude !== null) {
    const byCoords = store.entries[coordsId(city.latitude, city.longitude)];
    if (byCoords) return byCoords;
  }
  const byQuery = store.entries[`query:${city.query.toLowerCase()}`];
  if (byQuery && byQuery.city === city.query) return byQuery;
  return null;
}

export function pruneCacheEntries(store: CacheStore, cities: readonly SavedCity[]): boolean {
  const validIds = new Set(cities.map((item) => item.id));
  let changed = false;
  for (const key of Object.keys(store.entries)) {
    if (!validIds.has(key)) {
      delete store.entries[key];
      changed = true;
    }
  }
  return changed;
}
