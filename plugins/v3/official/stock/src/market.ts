import { marketOf, type Market, type Quote, type StockItem } from "./model.ts";

type Session = readonly [start: number, end: number];

interface Exchange {
  zone: string;
  sessions: readonly Session[];
}

export const EXCHANGES: Record<Exclude<Market, "other">, Exchange> = {
  cn: { zone: "Asia/Shanghai", sessions: [[9 * 60 + 15, 11 * 60 + 30], [13 * 60, 15 * 60]] },
  hk: { zone: "Asia/Hong_Kong", sessions: [[9 * 60 + 30, 12 * 60], [13 * 60, 16 * 60 + 10]] },
  us: { zone: "America/New_York", sessions: [[9 * 60 + 30, 16 * 60]] },
};

const HOLIDAY_GRACE_MINUTES = 30;
const STEP_MS = 5 * 60_000;
const LOOKAHEAD_MS = 4 * 24 * 60 * 60_000;

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
  minutes: number;
  seconds: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatter(zone: string): Intl.DateTimeFormat {
  let found = formatters.get(zone);
  if (!found) {
    found = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(zone, found);
  }
  return found;
}

export function zonedParts(at: number, zone: string): ZonedParts {
  const parts: Record<string, string> = {};
  for (const part of formatter(zone).formatToParts(new Date(at))) parts[part.type] = part.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: WEEKDAYS.indexOf(parts.weekday),
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
    seconds: Number(parts.second),
  };
}

export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, second: number, zone: string): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const seen = zonedParts(guess, zone);
  const seenUtc = Date.UTC(seen.year, seen.month - 1, seen.day, Math.floor(seen.minutes / 60), seen.minutes % 60, seen.seconds);
  return guess - (seenUtc - guess);
}

function sameDay(a: ZonedParts, b: ZonedParts): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function isSessionTime(market: Market, at: number): boolean {
  if (market === "other") return false;
  const exchange = EXCHANGES[market];
  const now = zonedParts(at, exchange.zone);
  if (now.weekday === 0 || now.weekday === 6) return false;
  return exchange.sessions.some(([start, end]) => now.minutes >= start && now.minutes < end);
}

export function looksLikeHoliday(market: Market, at: number, quotes: readonly (Quote | undefined)[]): boolean {
  if (market === "other" || !isSessionTime(market, at)) return false;
  const exchange = EXCHANGES[market];
  const now = zonedParts(at, exchange.zone);
  if (now.minutes < exchange.sessions[0][0] + HOLIDAY_GRACE_MINUTES) return false;
  const times = quotes.map((quote) => quote?.time ?? null).filter((time): time is number => time !== null);
  if (times.length === 0) return false;
  return times.every((time) => !sameDay(zonedParts(time, exchange.zone), now));
}

export function watchedMarkets(stocks: readonly StockItem[]): Set<Market> {
  const markets = new Set<Market>();
  for (const stock of stocks) markets.add(marketOf(stock.id));
  return markets;
}

export function anyOpen(markets: Iterable<Market>, at: number): boolean {
  for (const market of markets) {
    if (market === "other") {
      if ((["cn", "hk", "us"] as const).some((item) => isSessionTime(item, at))) return true;
    } else if (isSessionTime(market, at)) {
      return true;
    }
  }
  return false;
}

export function nextOpenAt(markets: Iterable<Market>, at: number): number | null {
  const list = [...markets];
  if (list.length === 0) return null;
  const start = Math.ceil(at / STEP_MS) * STEP_MS;
  for (let probe = start; probe <= at + LOOKAHEAD_MS; probe += STEP_MS) {
    if (anyOpen(list, probe)) return probe;
  }
  return null;
}
