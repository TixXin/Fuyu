import type { WeatherConfig } from "./config.ts";
import { inQuietHours, minutesBetween } from "./format.ts";
import type { WeatherForecast } from "./types.ts";

export const RAIN_MM = 0.1;
export const RAIN_QUIET_MS = 3 * 60 * 60 * 1000;
export const RAINING_QUIET_MS = 60 * 60 * 1000;

export type RainDecision = { kind: "none" } | { kind: "raining" } | { kind: "alert"; time: string };

type RainConfig = Pick<WeatherConfig, "rainAlert" | "rainLeadMinutes" | "quietHours" | "quietStart" | "quietEnd">;

export function rainDecision(forecast: WeatherForecast, config: RainConfig, at: number, quietUntil?: number): RainDecision {
  if (!config.rainAlert) return { kind: "none" };
  if (forecast.current.mm >= RAIN_MM) return { kind: "raining" };
  if (typeof quietUntil === "number" && quietUntil > at) return { kind: "none" };
  if (config.quietHours && inQuietHours(at, config.quietStart, config.quietEnd)) return { kind: "none" };
  const upcoming = forecast.soon.find((slot) => {
    if (slot.mm < RAIN_MM) return false;
    const ahead = minutesBetween(forecast.now, slot.time);
    return !Number.isFinite(ahead) || ahead <= config.rainLeadMinutes;
  });
  return upcoming ? { kind: "alert", time: upcoming.time } : { kind: "none" };
}
