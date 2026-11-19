import type { TemperatureUnit } from "./config.ts";
import type { WeatherForecast, WeatherPlace } from "./types.ts";

interface GeoResult {
  name?: string;
  admin1?: string;
  admin2?: string;
  country?: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
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
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
  };
  minutely_15?: {
    time?: string[];
    precipitation?: number[];
  };
}

async function getJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export function geocodeLanguage(query: string): "zh" | "en" {
  return /[\u3400-\u9fff]/.test(query) ? "zh" : "en";
}

export async function findPlace(cityInput: string): Promise<WeatherPlace | null> {
  const trimmed = cityInput.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/[,，]/, 2);
  const queryName = parts[0].trim();
  if (!queryName) return null;
  const hint = parts.length > 1 ? parts[1].trim().toLowerCase() : "";

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("count", "10");
  url.searchParams.set("format", "json");
  url.searchParams.set("language", geocodeLanguage(queryName));
  url.searchParams.set("name", queryName);

  const data = await getJson<{ results?: GeoResult[] }>(url);
  const results = Array.isArray(data.results) ? data.results.filter(Boolean) : [];
  if (results.length === 0) return null;

  let picked = results[0];
  if (hint) {
    for (const candidate of results) {
      const hay = [candidate.admin1, candidate.admin2, candidate.country, candidate.country_code]
        .filter((item): item is string => typeof item === "string" && item.length > 0)
        .map((item) => item.toLowerCase());
      if (hay.some((item) => item.includes(hint))) {
        picked = candidate;
        break;
      }
    }
  }

  if (typeof picked.latitude !== "number" || typeof picked.longitude !== "number") {
    return null;
  }

  return {
    name: String(picked.name ?? queryName),
    region: String(picked.admin1 ?? ""),
    country: String(picked.country ?? ""),
    latitude: picked.latitude,
    longitude: picked.longitude,
  };
}

function selectAfter(times: string[], from: string): number {
  for (let i = 0; i < times.length; i += 1) {
    if (times[i] >= from) return i;
  }
  return times.length;
}

export async function fetchForecast(place: WeatherPlace, units: TemperatureUnit): Promise<WeatherForecast> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("forecast_minutely_15", "8");
  url.searchParams.set("latitude", String(place.latitude));
  url.searchParams.set("longitude", String(place.longitude));
  url.searchParams.set("temperature_unit", units);
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,precipitation",
  );
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability,weather_code,is_day");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  url.searchParams.set("minutely_15", "precipitation");

  const raw = await getJson<ForecastResponse>(url);
  const now = String(raw.current?.time ?? "");
  const hourStart = now.length >= 13 ? `${now.slice(0, 13)}:00` : now;

  const hTimes = raw.hourly?.time ?? [];
  const firstHour = selectAfter(hTimes, hourStart);
  const hourly = [];
  for (let i = firstHour; i < Math.min(firstHour + 24, hTimes.length); i += 1) {
    hourly.push({
      time: String(hTimes[i]),
      temp: Number(raw.hourly?.temperature_2m?.[i] ?? 0),
      pop: Number(raw.hourly?.precipitation_probability?.[i] ?? 0),
      code: Number(raw.hourly?.weather_code?.[i] ?? 0),
      day: Number(raw.hourly?.is_day?.[i] ?? 1),
    });
  }

  const dTimes = raw.daily?.time ?? [];
  const daily = [];
  for (let i = 0; i < dTimes.length; i += 1) {
    daily.push({
      date: String(dTimes[i]),
      code: Number(raw.daily?.weather_code?.[i] ?? 0),
      max: Number(raw.daily?.temperature_2m_max?.[i] ?? 0),
      min: Number(raw.daily?.temperature_2m_min?.[i] ?? 0),
      pop: Number(raw.daily?.precipitation_probability_max?.[i] ?? 0),
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
    },
    hourly,
    daily,
    soon,
  };
}
