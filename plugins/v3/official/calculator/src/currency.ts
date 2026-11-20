export const CURRENCIES = [
  "CNY", "USD", "EUR", "JPY", "HKD", "GBP", "KRW", "TWD", "MOP", "SGD", "AUD", "CAD", "CHF", "NZD", "THB", "MYR",
  "RUB", "INR", "VND", "PHP", "IDR", "AED", "SAR", "SEK", "NOK", "DKK", "BRL", "MXN", "ZAR", "TRY",
] as const;

export const DEFAULT_FROM = "CNY";
export const RATES_URL = "https://open.er-api.com/v6/latest/USD";

export function convertCurrency(rates: Record<string, number>, value: number, from: string, to: string): number | null {
  const source = rates[from];
  const target = rates[to];
  if (!(source > 0) || !(target > 0)) return null;
  return (value / source) * target;
}

export function parseRatesResponse(data: unknown): { rates: Record<string, number>; updatedAt: number } | null {
  if (!data || typeof data !== "object") return null;
  const body = data as { result?: unknown; rates?: unknown; time_last_update_unix?: unknown };
  if (body.result !== "success" || !body.rates || typeof body.rates !== "object") return null;
  const rates: Record<string, number> = {};
  for (const [code, value] of Object.entries(body.rates as Record<string, unknown>)) {
    if (/^[A-Z]{3}$/.test(code) && typeof value === "number" && value > 0 && Number.isFinite(value)) rates[code] = value;
  }
  if (!rates.USD) return null;
  const updatedAt = typeof body.time_last_update_unix === "number" ? body.time_last_update_unix * 1000 : Date.now();
  return { rates, updatedAt };
}
