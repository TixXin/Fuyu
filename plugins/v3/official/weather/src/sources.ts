import type { HttpFetch } from "@fuyu/plugin-base";
import type { TemperatureUnit, WeatherSourceId } from "./config.ts";
import { fetchOpenMeteo } from "./openMeteo.ts";
import { fetchMetNo } from "./providerMetNo.ts";
import { fetchNmc } from "./providerNmc.ts";
import { fetchWttr } from "./providerWttr.ts";
import type { WeatherAirQuality, WeatherForecast, WeatherPlace } from "./types.ts";

export type ConcreteSourceId = Exclude<WeatherSourceId, "auto">;

export const SOURCE_CHOICES: readonly WeatherSourceId[] = [
  "auto",
  "nmc",
  "open-meteo",
  "open-meteo-cma",
  "metno",
  "wttr",
];

export function isChinaPlace(place: WeatherPlace): boolean {
  if (place.countryCode?.toUpperCase() === "CN") return true;
  if (place.country === "中国" || place.country.toLowerCase() === "china") return true;
  return (
    place.latitude >= 18 &&
    place.latitude <= 54 &&
    place.longitude >= 73 &&
    place.longitude <= 135 &&
    /[\u3400-\u9fff]/.test(`${place.name}${place.region}`)
  );
}

export function sourceChain(
  preferred: WeatherSourceId,
  place: WeatherPlace,
  autoFallback: boolean,
): ConcreteSourceId[] {
  const china = isChinaPlace(place);
  const defaults: ConcreteSourceId[] = china
    ? ["nmc", "open-meteo-cma", "metno", "open-meteo", "wttr"]
    : ["open-meteo", "metno", "wttr", "open-meteo-cma"];
  if (preferred === "auto") return defaults;
  if (!autoFallback) return [preferred];
  return [preferred, ...defaults.filter((id) => id !== preferred)];
}

export interface MultiSourceResult {
  forecast: WeatherForecast;
  sourceUsed: ConcreteSourceId;
  fallbackFrom: ConcreteSourceId | null;
  nmcStationId?: string;
  nmcAqi?: WeatherAirQuality | null;
}

async function fetchOne(
  source: ConcreteSourceId,
  place: WeatherPlace,
  units: TemperatureUnit,
  fetcher: HttpFetch,
  enrichNmcHourly: boolean,
): Promise<{ forecast: WeatherForecast; nmcStationId?: string; nmcAqi?: WeatherAirQuality | null }> {
  if (source === "open-meteo") {
    return { forecast: await fetchOpenMeteo(place, units, "best_match", fetcher) };
  }
  if (source === "open-meteo-cma") {
    return { forecast: await fetchOpenMeteo(place, units, "cma_grapes_global", fetcher) };
  }
  if (source === "metno") {
    return { forecast: await fetchMetNo(place, units, fetcher) };
  }
  if (source === "wttr") {
    return { forecast: await fetchWttr(place, units, fetcher) };
  }
  const nmc = await fetchNmc(place, units, fetcher);
  let forecast = nmc.forecast;
  if (enrichNmcHourly && forecast.hourly.length === 0) {
    try {
      const aux = await fetchOpenMeteo(place, units, "cma_grapes_global", fetcher);
      forecast = {
        ...forecast,
        hourly: aux.hourly,
        soon: aux.soon,
        current: {
          ...forecast.current,
          ...(aux.current.uv !== undefined ? { uv: aux.current.uv } : {}),
        },
        daily: forecast.daily.map((day, idx) => ({
          ...day,
          pop: day.pop || aux.daily[idx]?.pop || 0,
          ...(aux.daily[idx]?.uvMax !== undefined ? { uvMax: aux.daily[idx].uvMax } : {}),
        })),
      };
    } catch {
      forecast = nmc.forecast;
    }
  }
  return { forecast, nmcStationId: nmc.stationId, nmcAqi: nmc.aqi };
}

export async function fetchWeatherWithFallback(
  place: WeatherPlace,
  units: TemperatureUnit,
  preferred: WeatherSourceId,
  autoFallback: boolean,
  fetcher: HttpFetch,
): Promise<MultiSourceResult> {
  const chain = sourceChain(preferred, place, autoFallback);
  const errors: string[] = [];
  for (let i = 0; i < chain.length; i += 1) {
    const source = chain[i];
    try {
      const enrich = source === "nmc" && (preferred === "auto" || autoFallback);
      const res = await fetchOne(source, place, units, fetcher, enrich);
      const fallbackFrom = preferred !== "auto" && source !== preferred ? preferred : null;
      return {
        forecast: res.forecast,
        sourceUsed: source,
        fallbackFrom,
        nmcStationId: res.nmcStationId,
        nmcAqi: res.nmcAqi,
      };
    } catch (error) {
      errors.push(`${source}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(errors[0] ?? "All weather sources failed");
}
