import { EXCHANGES, zonedToUtc } from "./market.ts";
import { cnExchange, marketOf, type Quote, type SourceId, type StockItem, type TrendSeries } from "./model.ts";

export type HttpFetch = (input: string, init?: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 8000;
const SEARCH_TOKEN = "D43BF722C8E33BDC906FB84D85E326E8";
const EASTMONEY_FIELDS = "f2,f3,f4,f12,f13,f14,f15,f16,f17,f18,f124";
const MAX_TREND_POINTS = 64;

export const QUOTE_URL = "https://push2.eastmoney.com/api/qt/ulist.np/get";
export const TREND_URL = "https://push2.eastmoney.com/api/qt/stock/trends2/get";
export const SEARCH_URL = "https://searchapi.eastmoney.com/api/suggest/get";
export const TENCENT_URL = "https://qt.gtimg.cn/q=";
export const TENCENT_MIN_URL = "https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=";
export const TENCENT_US_MIN_URL = "https://web.ifzq.gtimg.cn/appstock/app/UsMinute/query?code=";

function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "" || value === "-") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function positiveNum(value: unknown): number | null {
  const n = num(value);
  return n !== null && n > 0 ? n : null;
}

async function getText(fetcher: HttpFetch, url: string): Promise<string> {
  const response = await fetcher(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

export function eastmoneyQuoteUrl(ids: readonly string[]): string {
  return `${QUOTE_URL}?fltt=2&invt=2&fields=${EASTMONEY_FIELDS}&secids=${ids.map(encodeURIComponent).join(",")}`;
}

export function parseEastmoney(body: string): Quote[] {
  const data = JSON.parse(body) as { data?: { diff?: unknown } | null };
  const diff = data?.data?.diff;
  const rows = Array.isArray(diff) ? diff : diff && typeof diff === "object" ? Object.values(diff) : [];
  const quotes: Quote[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    if (item.f12 === undefined || item.f13 === undefined) continue;
    const price = num(item.f2);
    const time = num(item.f124);
    const high = positiveNum(item.f15);
    const low = positiveNum(item.f16);
    const open = positiveNum(item.f17);
    const preClose = positiveNum(item.f18);
    quotes.push({
      id: `${item.f13}.${item.f12}`,
      price,
      change: price === null ? null : num(item.f4),
      percent: price === null ? null : num(item.f3),
      time: time !== null && time > 0 ? time * 1000 : null,
      ...(open !== null ? { open } : {}),
      ...(high !== null ? { high } : {}),
      ...(low !== null ? { low } : {}),
      ...(preClose !== null ? { preClose } : {}),
    });
  }
  return quotes;
}

export function tencentSymbol(id: string): string | null {
  const market = marketOf(id);
  const code = id.slice(id.indexOf(".") + 1);
  if (market === "cn") return `${cnExchange(id)}${code}`;
  if (market === "hk" && id.startsWith("116.")) return `hk${code}`;
  if (market === "us") return `us${code.replace(/_/g, ".")}`;
  return null;
}

export function tencentMinuteCode(id: string): { code: string; us: boolean } | null {
  const market = marketOf(id);
  const raw = id.slice(id.indexOf(".") + 1);
  if (market === "cn") return { code: `${cnExchange(id)}${raw}`, us: false };
  if (market === "hk" && id.startsWith("116.")) return { code: `hk${raw}`, us: false };
  if (market === "us") {
    const clean = raw.replace(/_/g, ".");
    const suffix = id.startsWith("105.") ? ".OQ" : id.startsWith("106.") ? ".N" : ".AM";
    return { code: `us${clean}${suffix}`, us: true };
  }
  return null;
}

function tencentTime(text: string, id: string): number | null {
  const match = /^(\d{4})[-/]?(\d{2})[-/]?(\d{2})[ ]?(\d{2}):?(\d{2}):?(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const market = marketOf(id);
  const zone = market === "other" ? EXCHANGES.cn.zone : EXCHANGES[market].zone;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  return zonedToUtc(y, mo, d, h, mi, s, zone);
}

export function parseTencent(body: string, ids: readonly string[]): Quote[] {
  const bySymbol = new Map<string, string>();
  for (const id of ids) {
    const symbol = tencentSymbol(id);
    if (symbol) bySymbol.set(symbol.toLowerCase(), id);
  }
  const quotes: Quote[] = [];
  for (const [, symbol, payload] of body.matchAll(/v_([A-Za-z0-9_.]+)="([^"]*)"/g)) {
    const id = bySymbol.get(symbol.toLowerCase());
    if (!id) continue;
    const parts = payload.split("~");
    const code = id.slice(id.indexOf(".") + 1).replace(/_/g, ".").toUpperCase();
    const at = parts.findIndex((part, index) => index >= 2 && (part.toUpperCase() === code || part.toUpperCase().startsWith(`${code}.`)));
    if (at < 0) continue;
    const price = num(parts[at + 1]);
    const live = price !== null && price > 0;
    const preClose = positiveNum(parts[at + 2]);
    const open = positiveNum(parts[at + 3]);
    const high = positiveNum(parts[at + 31]);
    const low = positiveNum(parts[at + 32]);
    quotes.push({
      id,
      price: live ? price : null,
      change: live ? num(parts[at + 29]) : null,
      percent: live ? num(parts[at + 30]) : null,
      time: tencentTime(parts[at + 28] ?? "", id),
      ...(open !== null ? { open } : {}),
      ...(high !== null ? { high } : {}),
      ...(low !== null ? { low } : {}),
      ...(preClose !== null ? { preClose } : {}),
    });
  }
  return quotes;
}

export function downsample(points: readonly number[], max: number = MAX_TREND_POINTS): number[] {
  if (points.length <= max) return [...points];
  const out: number[] = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i += 1) {
    out.push(points[Math.round(i * step)]);
  }
  return out;
}

export function parseTencentMinute(body: string, id: string, code: string): TrendSeries | null {
  const parsed = JSON.parse(body) as { data?: Record<string, { data?: { data?: unknown }; qt?: Record<string, unknown[]> }> };
  const bucket = parsed?.data?.[code] ?? Object.values(parsed?.data ?? {})[0];
  const rows = bucket?.data?.data;
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const rawPoints: number[] = [];
  for (const row of rows) {
    if (typeof row !== "string") continue;
    const parts = row.trim().split(/\s+/);
    const val = positiveNum(parts[1]);
    if (val !== null) rawPoints.push(val);
  }
  if (rawPoints.length < 2) return null;
  const qtRow = bucket?.qt?.[code] ?? Object.values(bucket?.qt ?? {})[0];
  const preClose = Array.isArray(qtRow) ? positiveNum(qtRow[4]) : null;
  return { id, preClose, points: downsample(rawPoints), updatedAt: Date.now() };
}

export function parseEastmoneyTrend(body: string, id: string): TrendSeries | null {
  const parsed = JSON.parse(body) as { data?: { preClose?: unknown; trends?: unknown } | null };
  const rows = parsed?.data?.trends;
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const rawPoints: number[] = [];
  for (const row of rows) {
    if (typeof row !== "string") continue;
    const parts = row.split(",");
    const val = positiveNum(parts[1]);
    if (val !== null) rawPoints.push(val);
  }
  if (rawPoints.length < 2) return null;
  return { id, preClose: positiveNum(parsed?.data?.preClose), points: downsample(rawPoints), updatedAt: Date.now() };
}

async function fetchTencentTrend(fetcher: HttpFetch, id: string): Promise<TrendSeries | null> {
  const mapped = tencentMinuteCode(id);
  if (!mapped) return null;
  const base = mapped.us ? TENCENT_US_MIN_URL : TENCENT_MIN_URL;
  try {
    return parseTencentMinute(await getText(fetcher, `${base}${encodeURIComponent(mapped.code)}`), id, mapped.code);
  } catch {
    return null;
  }
}

export async function fetchTrend(fetcher: HttpFetch, id: string): Promise<TrendSeries | null> {
  const fromTencent = await fetchTencentTrend(fetcher, id);
  if (fromTencent) return fromTencent;
  try {
    const url = `${TREND_URL}?fields1=f1,f2,f3,f5,f8,f10&fields2=f51,f53&secid=${encodeURIComponent(id)}&ndays=1&iscr=0`;
    return parseEastmoneyTrend(await getText(fetcher, url), id);
  } catch {
    return null;
  }
}

export interface FetchResult {
  quotes: Quote[];
  source: SourceId;
}

export async function fetchQuotes(fetcher: HttpFetch, ids: readonly string[]): Promise<FetchResult> {
  let firstError: unknown = null;
  try {
    const quotes = parseEastmoney(await getText(fetcher, eastmoneyQuoteUrl(ids)));
    if (quotes.length > 0) return { quotes, source: "eastmoney" };
  } catch (error) {
    firstError = error;
  }
  const symbols = ids.map(tencentSymbol).filter((symbol): symbol is string => symbol !== null);
  if (symbols.length === 0) throw firstError ?? new Error("no quotes");
  try {
    const quotes = parseTencent(await getText(fetcher, `${TENCENT_URL}${symbols.join(",")}`), ids);
    if (quotes.length > 0) return { quotes, source: "tencent" };
  } catch (error) {
    firstError ??= error;
  }
  throw firstError ?? new Error("no quotes");
}

export function searchUrl(keyword: string): string {
  const query = new URLSearchParams({ input: keyword, type: "14", token: SEARCH_TOKEN, count: "10" });
  return `${SEARCH_URL}?${query.toString()}`;
}

export function parseSearch(body: string): StockItem[] {
  const data = JSON.parse(body) as { QuotationCodeTable?: { Data?: unknown } };
  const rows = data?.QuotationCodeTable?.Data;
  if (!Array.isArray(rows)) return [];
  const found: StockItem[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const id = typeof item.QuoteID === "string" ? item.QuoteID : "";
    if (!/^\d{1,3}\.[A-Za-z0-9_.-]{1,16}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    found.push({
      id,
      code: typeof item.Code === "string" ? item.Code : id.slice(id.indexOf(".") + 1),
      name: typeof item.Name === "string" && item.Name.trim() ? item.Name.trim().slice(0, 32) : id,
      kind: typeof item.SecurityTypeName === "string" ? item.SecurityTypeName.slice(0, 16) : "",
    });
  }
  return found.slice(0, 8);
}

export async function searchStocks(fetcher: HttpFetch, keyword: string): Promise<StockItem[]> {
  const text = keyword.trim().slice(0, 32);
  if (!text) return [];
  return parseSearch(await getText(fetcher, searchUrl(text)));
}
