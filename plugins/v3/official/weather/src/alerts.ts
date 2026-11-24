import type { WeatherConfig } from "./config.ts";
import { inQuietHours, minutesBetween } from "./format.ts";
import type { WeatherForecast } from "./types.ts";

export type ExtremeKind = "storm" | "freezing" | "heavySnow" | "heavyRain" | "highWind";

export const EXTREME_WIND_KMH = 62;
export const EXTREME_LOOKAHEAD_HOURS = 6;
export const EXTREME_QUIET_MS = 6 * 60 * 60 * 1000;

export type ExtremeQuietMap = Partial<Record<ExtremeKind, number>>;

export type ExtremeDecision =
  | { kind: "none" }
  | { kind: "alert"; hazard: ExtremeKind; now: boolean; time: string; windKmh?: number };

type ExtremeConfig = Pick<WeatherConfig, "extremeAlert" | "quietHours" | "quietStart" | "quietEnd">;

const PRIORITY: readonly ExtremeKind[] = ["storm", "freezing", "heavySnow", "heavyRain", "highWind"];
const STORM_CODES = new Set([95, 96, 99]);
const FREEZING_CODES = new Set([56, 57, 66, 67]);
const HEAVY_SNOW_CODES = new Set([75, 86]);
const HEAVY_RAIN_CODES = new Set([65, 82]);

export function codeHazard(code: number): ExtremeKind | null {
  if (STORM_CODES.has(code)) return "storm";
  if (FREEZING_CODES.has(code)) return "freezing";
  if (HEAVY_SNOW_CODES.has(code)) return "heavySnow";
  if (HEAVY_RAIN_CODES.has(code)) return "heavyRain";
  return null;
}

interface Candidate {
  hazard: ExtremeKind;
  now: boolean;
  time: string;
  windKmh?: number;
}

function collectCandidates(forecast: WeatherForecast): Candidate[] {
  const found: Candidate[] = [];
  const currentCode = codeHazard(forecast.current.code);
  if (currentCode) {
    found.push({ hazard: currentCode, now: true, time: forecast.now });
  }
  if (forecast.current.wind >= EXTREME_WIND_KMH) {
    found.push({ hazard: "highWind", now: true, time: forecast.now, windKmh: forecast.current.wind });
  }
  for (const hour of forecast.hourly.slice(0, EXTREME_LOOKAHEAD_HOURS)) {
    const ahead = minutesBetween(forecast.now, hour.time);
    if (Number.isFinite(ahead) && ahead < 0) continue;
    const hazard = codeHazard(hour.code);
    if (hazard) {
      found.push({ hazard, now: false, time: hour.time });
    }
    if (typeof hour.wind === "number" && hour.wind >= EXTREME_WIND_KMH) {
      found.push({ hazard: "highWind", now: false, time: hour.time, windKmh: hour.wind });
    }
  }
  return found;
}

export function extremeDecision(
  forecast: WeatherForecast,
  config: ExtremeConfig,
  at: number,
  quietUntil?: ExtremeQuietMap,
): ExtremeDecision {
  if (!config.extremeAlert) return { kind: "none" };
  if (config.quietHours && inQuietHours(at, config.quietStart, config.quietEnd)) return { kind: "none" };
  const candidates = collectCandidates(forecast);
  if (candidates.length === 0) return { kind: "none" };
  for (const hazard of PRIORITY) {
    const picked = candidates.find((item) => item.hazard === hazard);
    if (!picked) continue;
    const until = quietUntil?.[hazard];
    if (typeof until === "number" && until > at) continue;
    return {
      kind: "alert",
      hazard: picked.hazard,
      now: picked.now,
      time: picked.time,
      windKmh: picked.windKmh,
    };
  }
  return { kind: "none" };
}
