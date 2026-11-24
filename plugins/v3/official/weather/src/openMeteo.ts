import type { HttpFetch } from "@fuyu/plugin-base";
import { coordsId, type TemperatureUnit } from "./config.ts";
import type { WeatherAirQuality, WeatherForecast, WeatherPlace } from "./types.ts";

export const REQUEST_TIMEOUT_MS = 12_000;

interface GeoResult {
  name?: string;
  admin1?: string;
  admin2?: string;
  country?: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

interface ForecastResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
    is_day?: number;
    wind_speed_10m?: number;
    precipitation?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
    weather_code?: number[];
    is_day?: number[];
    wind_speed_10m?: number[];
    uv_index?: number[];
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    sunrise?: string[];
    sunset?: string[];
    uv_index_max?: number[];
  };
  minutely_15?: {
    time?: string[];
    precipitation?: number[];
  };
}

interface AirQualityResponse {
  current?: {
    time?: string;
    us_aqi?: number;
    pm2_5?: number;
    pm10?: number;
  };
}

const defaultFetch: HttpFetch = (input, init) => fetch(input, init);

function timeoutSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }
  return undefined;
}

async function getJson<T>(url: URL, fetcher: HttpFetch = defaultFetch): Promise<T> {
  const signal = timeoutSignal();
  const init: Record<string, unknown> = {
    headers: { Accept: "application/json" },
  };
  if (signal) init.signal = signal;
  const response = await fetcher(url, init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export function geocodeLanguage(query: string): "zh" | "en" {
  return /[\u3400-\u9fff]/.test(query) ? "zh" : "en";
}

function toPlace(candidate: GeoResult, fallbackName: string): WeatherPlace | null {
  if (typeof candidate.latitude !== "number" || typeof candidate.longitude !== "number") {
    return null;
  }
  return {
    id: coordsId(candidate.latitude, candidate.longitude),
    name: String(candidate.name ?? fallbackName),
    region: String(candidate.admin1 ?? ""),
    country: String(candidate.country ?? ""),
    countryCode: typeof candidate.country_code === "string" ? candidate.country_code : undefined,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    timezone: typeof candidate.timezone === "string" ? candidate.timezone : undefined,
  };
}

export async function searchPlaces(cityInput: string, fetcher: HttpFetch = defaultFetch): Promise<WeatherPlace[]> {
  const trimmed = cityInput.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/[,，]/, 2);
  const queryName = parts[0].trim();
  if (!queryName) return [];
  const hint = parts.length > 1 ? parts[1].trim().toLowerCase() : "";

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("count", "10");
  url.searchParams.set("format", "json");
  url.searchParams.set("language", geocodeLanguage(queryName));
  url.searchParams.set("name", queryName);

  const data = await getJson<{ results?: GeoResult[] }>(url, fetcher);
  const results = Array.isArray(data.results) ? data.results.filter(Boolean) : [];
  if (results.length === 0) return [];

  const scored = results.map((candidate, index) => {
    let matched = false;
    if (hint) {
      const hay = [candidate.admin1, candidate.admin2, candidate.country, candidate.country_code]
        .filter((item): item is string => typeof item === "string" && item.length > 0)
        .map((item) => item.toLowerCase());
      matched = hay.some((item) => item.includes(hint));
    }
    return { candidate, matched, index };
  });

  if (hint && scored.some((item) => item.matched)) {
    scored.sort((a, b) => Number(b.matched) - Number(a.matched) || a.index - b.index);
  }

  const seen = new Set<string>();
  const places: WeatherPlace[] = [];
  for (const { candidate } of scored) {
    const place = toPlace(candidate, queryName);
    if (!place || !place.id || seen.has(place.id)) continue;
    seen.add(place.id);
    places.push(place);
    if (places.length >= 8) break;
  }
  return places;
}

export async function findPlace(cityInput: string, fetcher: HttpFetch = defaultFetch): Promise<WeatherPlace | null> {
  const places = await searchPlaces(cityInput, fetcher);
  return places[0] ?? null;
}

function selectAfter(times: string[], from: string): number {
  for (let i = 0; i < times.length; i += 1) {
    if (times[i] >= from) return i;
  }
  return times.length;
}

function optNumber(list: number[] | undefined, index: number): number | undefined {
  const val = list?.[index];
  return typeof val === "number" && Number.isFinite(val) ? val : undefined;
}

export async function fetchOpenMeteo(
  place: WeatherPlace,
  units: TemperatureUnit,
  model: "best_match" | "cma_grapes_global" = "best_match",
  fetcher: HttpFetch = defaultFetch,
): Promise<WeatherForecast> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("forecast_minutely_15", "8");
  url.searchParams.set("latitude", String(place.latitude));
  url.searchParams.set("longitude", String(place.longitude));
  url.searchParams.set("temperature_unit", units);
  url.searchParams.set("wind_speed_unit", "kmh");
  if (model !== "best_match") {
    url.searchParams.set("models", model);
  }
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,precipitation",
  );
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability,weather_code,is_day,wind_speed_10m,uv_index");
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max",
  );
  url.searchParams.set("minutely_15", "precipitation");

  const raw = await getJson<ForecastResponse>(url, fetcher);
  const now = String(raw.current?.time ?? "");
  const hourStart = now.length >= 13 ? `${now.slice(0, 13)}:00` : now;

  const hTimes = raw.hourly?.time ?? [];
  const firstHour = selectAfter(hTimes, hourStart);
  const hourly = [];
  for (let i = firstHour; i < Math.min(firstHour + 24, hTimes.length); i += 1) {
    const wind = optNumber(raw.hourly?.wind_speed_10m, i);
    const uv = optNumber(raw.hourly?.uv_index, i);
    hourly.push({
      time: String(hTimes[i]),
      temp: Number(raw.hourly?.temperature_2m?.[i] ?? 0),
      pop: Number(raw.hourly?.precipitation_probability?.[i] ?? 0),
      code: Number(raw.hourly?.weather_code?.[i] ?? 0),
      day: Number(raw.hourly?.is_day?.[i] ?? 1),
      ...(wind !== undefined ? { wind } : {}),
      ...(uv !== undefined ? { uv } : {}),
    });
  }

  const dTimes = raw.daily?.time ?? [];
  const daily = [];
  for (let i = 0; i < dTimes.length; i += 1) {
    const sunrise = raw.daily?.sunrise?.[i];
    const sunset = raw.daily?.sunset?.[i];
    const uvMax = optNumber(raw.daily?.uv_index_max, i);
    daily.push({
      date: String(dTimes[i]),
      code: Number(raw.daily?.weather_code?.[i] ?? 0),
      max: Number(raw.daily?.temperature_2m_max?.[i] ?? 0),
      min: Number(raw.daily?.temperature_2m_min?.[i] ?? 0),
      pop: Number(raw.daily?.precipitation_probability_max?.[i] ?? 0),
      ...(typeof sunrise === "string" ? { sunrise } : {}),
      ...(typeof sunset === "string" ? { sunset } : {}),
      ...(uvMax !== undefined ? { uvMax } : {}),
    });
  }

  const mTimes = raw.minutely_15?.time ?? [];
  const firstSoon = selectAfter(mTimes, now);
  const soon = [];
  for (let i = firstSoon; i < Math.min(firstSoon + 8, mTimes.length); i += 1) {
    soon.push({
      time: String(mTimes[i]),
      mm: Number(raw.minutely_15?.precipitation?.[i] ?? 0),
    });
  }

  const currentUv = hourly[0]?.uv;

  return {
    now,
    current: {
      temp: Number(raw.current?.temperature_2m ?? 0),
      feels: Number(raw.current?.apparent_temperature ?? 0),
      humidity: Number(raw.current?.relative_humidity_2m ?? 0),
      wind: Number(raw.current?.wind_speed_10m ?? 0),
      code: Number(raw.current?.weather_code ?? 0),
      day: Number(raw.current?.is_day ?? 1),
      mm: Number(raw.current?.precipitation ?? 0),
      ...(currentUv !== undefined ? { uv: currentUv } : {}),
    },
    hourly,
    daily,
    soon,
  };
}

export async function fetchForecast(
  place: WeatherPlace,
  units: TemperatureUnit,
  fetcher: HttpFetch = defaultFetch,
): Promise<WeatherForecast> {
  return fetchOpenMeteo(place, units, "best_match", fetcher);
}

export async function fetchAirQuality(
  place: WeatherPlace,
  fetcher: HttpFetch = defaultFetch,
): Promise<WeatherAirQuality | null> {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("latitude", String(place.latitude));
  url.searchParams.set("longitude", String(place.longitude));
  url.searchParams.set("current", "us_aqi,pm2_5,pm10");

  const raw = await getJson<AirQualityResponse>(url, fetcher);
  const usAqi = raw.current?.us_aqi;
  if (typeof usAqi !== "number" || !Number.isFinite(usAqi)) return null;
  const pm25 = typeof raw.current?.pm2_5 === "number" && Number.isFinite(raw.current.pm2_5) ? raw.current.pm2_5 : null;
  const pm10 = typeof raw.current?.pm10 === "number" && Number.isFinite(raw.current.pm10) ? raw.current.pm10 : null;
  return {
    usAqi: Math.round(usAqi),
    pm25,
    pm10,
    time: String(raw.current?.time ?? ""),
  };
}
