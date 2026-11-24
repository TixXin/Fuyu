import type { HttpFetch } from "@fuyu/plugin-base";
import type { TemperatureUnit } from "./config.ts";
import { convertForecastUnits } from "./format.ts";
import { REQUEST_TIMEOUT_MS } from "./openMeteo.ts";
import type { WeatherDay, WeatherForecast, WeatherHour, WeatherPlace, WeatherSoon } from "./types.ts";

const USER_AGENT = "FuyuWeather/1.4 (fuyu-desktop)";

interface MetNoPoint {
  time?: string;
  data?: {
    instant?: {
      details?: {
        air_temperature?: number;
        relative_humidity?: number;
        wind_speed?: number;
      };
    };
    next_1_hours?: {
      summary?: { symbol_code?: string };
      details?: { precipitation_amount?: number };
    };
    next_6_hours?: {
      summary?: { symbol_code?: string };
      details?: { precipitation_amount?: number };
    };
  };
}

interface MetNoResponse {
  properties?: { timeseries?: MetNoPoint[] };
}

function timeoutSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }
  return undefined;
}

export function metNoSymbolToWmo(symbol: string | undefined): number {
  const s = String(symbol ?? "").replace(/_(day|night|polartwilight)$/, "");
  if (!s) return 2;
  if (s.includes("thunder")) return 95;
  if (s.includes("heavysnow")) return 75;
  if (s.includes("snowshowers")) return 85;
  if (s.includes("snow")) return 71;
  if (s.includes("sleet")) return 66;
  if (s.includes("heavyrainshowers")) return 82;
  if (s.includes("rainshowers")) return 80;
  if (s.includes("heavyrain")) return 65;
  if (s.includes("lightrain")) return 61;
  if (s.includes("rain")) return 63;
  if (s.includes("fog")) return 45;
  if (s === "cloudy") return 3;
  if (s === "partlycloudy") return 2;
  if (s === "fair") return 1;
  if (s === "clearsky") return 0;
  return 2;
}

function formatInTimezone(utcIso: string, timezone: string | undefined, lon: number): string {
  const ms = Date.parse(utcIso);
  if (!Number.isFinite(ms)) return utcIso.slice(0, 16);
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(new Date(ms));
      const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
      const hour = map.hour === "24" ? "00" : map.hour;
      return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}`;
    } catch {
      return formatWithOffset(ms, lon);
    }
  }
  return formatWithOffset(ms, lon);
}

function formatWithOffset(ms: number, lon: number): string {
  const offsetHours = Math.round(lon / 15);
  const shifted = new Date(ms + offsetHours * 3600_000);
  return shifted.toISOString().slice(0, 16);
}

function feelsLikeC(tempC: number, humidity: number, windKmh: number): number {
  if (tempC <= 10 && windKmh >= 4.8) {
    const wc = 13.12 + 0.6215 * tempC - 11.37 * windKmh ** 0.16 + 0.3965 * tempC * windKmh ** 0.16;
    return Math.round(wc * 10) / 10;
  }
  const e = (humidity / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  const at = tempC + 0.33 * e - 0.7 * (windKmh / 3.6) - 4.0;
  return Math.round(at * 10) / 10;
}

function popFromMm(mm: number): number {
  if (mm <= 0) return 0;
  if (mm < 0.2) return 30;
  if (mm < 1) return 55;
  if (mm < 3) return 75;
  return 90;
}

export async function fetchMetNo(
  place: WeatherPlace,
  units: TemperatureUnit,
  fetcher: HttpFetch,
): Promise<WeatherForecast> {
  const url = new URL("https://api.met.no/weatherapi/locationforecast/2.0/compact");
  url.searchParams.set("lat", place.latitude.toFixed(4));
  url.searchParams.set("lon", place.longitude.toFixed(4));

  const signal = timeoutSignal();
  const init: Record<string, unknown> = {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  };
  if (signal) init.signal = signal;
  const response = await fetcher(url, init);
  if (!response.ok) throw new Error(`MET Norway HTTP ${response.status}`);
  const body = (await response.json()) as MetNoResponse;
  const series = Array.isArray(body.properties?.timeseries) ? body.properties.timeseries : [];
  if (series.length === 0) throw new Error("MET Norway empty timeseries");

  const first = series[0];
  const nowLocal = formatInTimezone(String(first.time ?? ""), place.timezone, place.longitude);
  const d0 = first.data?.instant?.details;
  const temp0 = Number(d0?.air_temperature ?? 0);
  const hum0 = Number(d0?.relative_humidity ?? 0);
  const windKmh0 = Math.round(Number(d0?.wind_speed ?? 0) * 3.6 * 10) / 10;
  const sym0 = first.data?.next_1_hours?.summary?.symbol_code ?? first.data?.next_6_hours?.summary?.symbol_code;
  const rain0 = Number(first.data?.next_1_hours?.details?.precipitation_amount ?? 0);

  const hourly: WeatherHour[] = [];
  const soon: WeatherSoon[] = [];
  const byDay = new Map<string, { temps: number[]; codes: number[]; pops: number[] }>();

  for (const pt of series) {
    if (!pt.time) continue;
    const local = formatInTimezone(pt.time, place.timezone, place.longitude);
    const details = pt.data?.instant?.details;
    const t = details?.air_temperature;
    if (typeof t !== "number" || !Number.isFinite(t)) continue;
    const sym = pt.data?.next_1_hours?.summary?.symbol_code ?? pt.data?.next_6_hours?.summary?.symbol_code;
    const code = metNoSymbolToWmo(sym);
    const mm = Number(pt.data?.next_1_hours?.details?.precipitation_amount ?? pt.data?.next_6_hours?.details?.precipitation_amount ?? 0);
    const pop = popFromMm(mm);
    const wind = Math.round(Number(details?.wind_speed ?? 0) * 3.6 * 10) / 10;
    const isDay = sym ? (sym.endsWith("_night") ? 0 : 1) : Number(local.slice(11, 13)) >= 6 && Number(local.slice(11, 13)) < 18 ? 1 : 0;

    if (hourly.length < 24) {
      hourly.push({ time: local, temp: t, pop, code, day: isDay, wind });
    }
    if (soon.length < 4 && pt.data?.next_1_hours) {
      soon.push({ time: local, mm });
    }
    const dayKey = local.slice(0, 10);
    let bucket = byDay.get(dayKey);
    if (!bucket) {
      bucket = { temps: [], codes: [], pops: [] };
      byDay.set(dayKey, bucket);
    }
    bucket.temps.push(t);
    bucket.codes.push(code);
    bucket.pops.push(pop);
  }

  const daily: WeatherDay[] = [];
  for (const [date, bucket] of byDay) {
    if (daily.length >= 7) break;
    daily.push({
      date,
      code: Math.max(...bucket.codes),
      max: Math.max(...bucket.temps),
      min: Math.min(...bucket.temps),
      pop: Math.max(...bucket.pops),
    });
  }

  const celsiusForecast: WeatherForecast = {
    now: nowLocal,
    current: {
      temp: temp0,
      feels: feelsLikeC(temp0, hum0, windKmh0),
      humidity: hum0,
      wind: windKmh0,
      code: metNoSymbolToWmo(sym0),
      day: sym0?.endsWith("_night") ? 0 : 1,
      mm: rain0,
    },
    hourly,
    daily,
    soon,
  };

  return convertForecastUnits(celsiusForecast, "celsius", units);
}
