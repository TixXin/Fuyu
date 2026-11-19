import type { TimeFormat, WindUnit } from "./config.ts";

const BEAUFORT_KMH = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];

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
