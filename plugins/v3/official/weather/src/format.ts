import type { TemperatureUnit, TimeFormat, WindUnit } from "./config.ts";
import type { WeatherForecast } from "./types.ts";

const BEAUFORT_KMH = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];

export type AqiTone = "good" | "moderate" | "sensitive" | "unhealthy" | "very" | "hazardous";

export function systemUses12Hour(locale?: string): boolean {
  try {
    const cycle = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hourCycle;
    return cycle === "h11" || cycle === "h12";
  } catch {
    return false;
  }
}

export function uses12Hour(format: TimeFormat, systemTwelve: boolean): boolean {
  if (format === "12") return true;
  if (format === "24") return false;
  return systemTwelve;
}

export function formatClock(hhmm: string, twelve: boolean, zh: boolean): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!match) return hhmm;
  const h = Number(match[1]);
  const m = match[2];
  if (!twelve) return `${String(h).padStart(2, "0")}:${m}`;
  const hour = h % 12 === 0 ? 12 : h % 12;
  if (zh) return `${h < 12 ? "上午" : "下午"}${hour}:${m}`;
  return `${hour}:${m} ${h < 12 ? "AM" : "PM"}`;
}

export function clockOfIso(iso: string): string {
  return iso.length >= 16 ? iso.slice(11, 16) : iso;
}

export function clockOfMs(at: number): string {
  const dt = new Date(at);
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

export function sameLocalDay(a: number, b: number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

export function weekdayOf(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return -1;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
}

export function beaufort(kmh: number): number {
  let level = 0;
  for (const limit of BEAUFORT_KMH) {
    if (kmh >= limit) level += 1;
  }
  return level;
}

export function formatWind(kmh: number, unit: WindUnit, zh: boolean): string {
  if (!Number.isFinite(kmh)) return "—";
  if (unit === "bft") return zh ? `${beaufort(kmh)} 级` : `Force ${beaufort(kmh)}`;
  if (unit === "ms") return `${(kmh / 3.6).toFixed(1)} m/s`;
  if (unit === "mph") return `${Math.round(kmh / 1.609344)} mph`;
  return `${Math.round(kmh)} km/h`;
}

export function convertTemp(value: number, from: TemperatureUnit, to: TemperatureUnit): number {
  if (from === to || !Number.isFinite(value)) return value;
  const converted = to === "fahrenheit" ? (value * 9) / 5 + 32 : ((value - 32) * 5) / 9;
  return Math.round(converted * 10) / 10;
}

export function convertForecastUnits(forecast: WeatherForecast, from: TemperatureUnit, to: TemperatureUnit): WeatherForecast {
  if (from === to) return forecast;
  return {
    ...forecast,
    current: {
      ...forecast.current,
      temp: convertTemp(forecast.current.temp, from, to),
      feels: convertTemp(forecast.current.feels, from, to),
    },
    hourly: forecast.hourly.map((hour) => ({
      ...hour,
      temp: convertTemp(hour.temp, from, to),
    })),
    daily: forecast.daily.map((day) => ({
      ...day,
      min: convertTemp(day.min, from, to),
      max: convertTemp(day.max, from, to),
    })),
  };
}

export function placeDetail(place: { name: string; region: string; country: string }): string {
  const parts: string[] = [];
  if (place.region && place.region !== place.name) parts.push(place.region);
  if (place.country && place.country !== place.region && place.country !== place.name) parts.push(place.country);
  return parts.join(" · ");
}

export function placeLine(place: { name: string; region: string; country: string }): string {
  const detail = placeDetail(place);
  return detail ? `${place.name} · ${detail}` : place.name;
}

export function aqiInfo(usAqi: number, zh: boolean): { tone: AqiTone; label: string } {
  if (usAqi <= 50) return { tone: "good", label: zh ? "优" : "Good" };
  if (usAqi <= 100) return { tone: "moderate", label: zh ? "良" : "Moderate" };
  if (usAqi <= 150) return { tone: "sensitive", label: zh ? "轻度" : "Sensitive" };
  if (usAqi <= 200) return { tone: "unhealthy", label: zh ? "中度" : "Unhealthy" };
  if (usAqi <= 300) return { tone: "very", label: zh ? "重度" : "Very unhealthy" };
  return { tone: "hazardous", label: zh ? "严重" : "Hazardous" };
}

export function uvLevel(uv: number, zh: boolean): string {
  if (uv < 3) return zh ? "弱" : "Low";
  if (uv < 6) return zh ? "中等" : "Moderate";
  if (uv < 8) return zh ? "强" : "High";
  if (uv < 11) return zh ? "很强" : "Very high";
  return zh ? "极强" : "Extreme";
}

export function tempRangeBar(min: number, max: number, weekMin: number, weekMax: number): { left: number; width: number } {
  const span = weekMax - weekMin;
  if (!Number.isFinite(span) || span <= 0.1) return { left: 0, width: 100 };
  const rawLeft = ((min - weekMin) / span) * 100;
  const rawRight = ((max - weekMin) / span) * 100;
  const left = Math.max(0, Math.min(92, rawLeft));
  const width = Math.max(8, Math.min(100 - left, rawRight - left));
  return { left: Math.round(left * 10) / 10, width: Math.round(width * 10) / 10 };
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function inQuietHours(at: number, start: string, end: string): boolean {
  const from = minutesOf(start);
  const to = minutesOf(end);
  if (from === to) return false;
  const dt = new Date(at);
  const now = dt.getHours() * 60 + dt.getMinutes();
  return from < to ? now >= from && now < to : now >= from || now < to;
}

function isoMinutes(iso: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return Number.NaN;
  const [, y, mo, d, h, mi] = match.map(Number);
  return Date.UTC(y, mo - 1, d, h, mi) / 60_000;
}

export function minutesBetween(fromIso: string, toIso: string): number {
  return isoMinutes(toIso) - isoMinutes(fromIso);
}
