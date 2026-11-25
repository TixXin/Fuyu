import type { HttpFetch } from "@fuyu/plugin-base";
import type { TemperatureUnit } from "./config.ts";
import { convertForecastUnits } from "./format.ts";
import { REQUEST_TIMEOUT_MS } from "./openMeteo.ts";
import type { WeatherDay, WeatherForecast, WeatherHour, WeatherPlace, WeatherSoon } from "./types.ts";

const USER_AGENT = "FuyuWeather/1.4 (fuyu-desktop)";

interface WttrResponse {
  current_condition?: Array<{
    temp_C?: string;
    FeelsLikeC?: string;
    humidity?: string;
    windspeedKmph?: string;
    weatherCode?: string;
    precipMM?: string;
    uvIndex?: string;
    localObsDateTime?: string;
  }>;
  weather?: Array<{
    date?: string;
    mintempC?: string;
    maxtempC?: string;
    uvIndex?: string;
    astronomy?: Array<{ sunrise?: string; sunset?: string }>;
    hourly?: Array<{
      time?: string;
      tempC?: string;
      chanceofrain?: string;
      weatherCode?: string;
      windspeedKmph?: string;
      precipMM?: string;
      uvIndex?: string;
    }>;
  }>;
}

function timeoutSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }
  return undefined;
}

export function wwoCodeToWmo(code: number): number {
  if (code === 113) return 0;
  if (code === 116) return 2;
  if (code === 119 || code === 122) return 3;
  if (code === 143 || code === 248 || code === 260) return 45;
  if ([200, 386, 389, 392, 395].includes(code)) return 95;
  if ([182, 185, 281, 284, 311, 314, 317, 320, 362, 365, 374, 377].includes(code)) return 66;
  if ([230, 335, 338, 371].includes(code)) return 75;
  if ([179, 227, 323, 326, 329, 332, 368].includes(code)) return 71;
  if ([305, 308, 359].includes(code)) return 65;
  if ([299, 302, 356].includes(code)) return 63;
  if ([176, 263, 266, 293, 296, 353].includes(code)) return 61;
  return 2;
}

function parseClock12(date: string, text: string | undefined): string | undefined {
  if (!text) return undefined;
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(text.trim());
  if (!m) return undefined;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return `${date}T${String(h).padStart(2, "0")}:${m[2]}`;
}

function wttrHourIso(date: string, rawTime: string | undefined): string {
  const padded = String(rawTime ?? "0").padStart(4, "0");
  return `${date}T${padded.slice(0, 2)}:${padded.slice(2, 4)}`;
}

export async function fetchWttr(
  place: WeatherPlace,
  units: TemperatureUnit,
  fetcher: HttpFetch,
): Promise<WeatherForecast> {
  const url = `https://wttr.in/${place.latitude.toFixed(4)},${place.longitude.toFixed(4)}?format=j1`;
  const signal = timeoutSignal();
  const init: Record<string, unknown> = {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  };
  if (signal) init.signal = signal;
  const response = await fetcher(url, init);
  if (!response.ok) throw new Error(`wttr.in HTTP ${response.status}`);
  const body = (await response.json()) as WttrResponse;
  const cur = body.current_condition?.[0];
  if (!cur) throw new Error("wttr.in empty current_condition");

  const days = Array.isArray(body.weather) ? body.weather : [];
  const todayDate = days[0]?.date ?? new Date().toISOString().slice(0, 10);
  const nowClock = new Date().toISOString().slice(11, 16);
  const now = `${todayDate}T${nowClock}`;

  const hourly: WeatherHour[] = [];
  const daily: WeatherDay[] = [];
  const soon: WeatherSoon[] = [];

  for (const day of days) {
    if (!day.date) continue;
    const astro = day.astronomy?.[0];
    const sunrise = parseClock12(day.date, astro?.sunrise);
    const sunset = parseClock12(day.date, astro?.sunset);
    const slots = Array.isArray(day.hourly) ? day.hourly : [];
    const codes: number[] = [];
    const pops: number[] = [];
    for (const slot of slots) {
      const iso = wttrHourIso(day.date, slot.time);
      const code = wwoCodeToWmo(Number(slot.weatherCode ?? 116));
      const pop = Number(slot.chanceofrain ?? 0);
      const hr = Number(iso.slice(11, 13));
      codes.push(code);
      pops.push(pop);
      if (iso >= `${now.slice(0, 13)}:00` && hourly.length < 24) {
        hourly.push({
          time: iso,
          temp: Number(slot.tempC ?? 0),
          pop,
          code,
          day: hr >= 6 && hr < 18 ? 1 : 0,
          wind: Number(slot.windspeedKmph ?? 0),
          uv: Number(slot.uvIndex ?? 0),
        });
        if (soon.length < 2) {
          soon.push({ time: iso, mm: Number(slot.precipMM ?? 0) });
        }
      }
    }
    daily.push({
      date: day.date,
      code: codes.length > 0 ? Math.max(...codes) : 2,
      max: Number(day.maxtempC ?? 0),
      min: Number(day.mintempC ?? 0),
      pop: pops.length > 0 ? Math.max(...pops) : 0,
      ...(sunrise ? { sunrise } : {}),
      ...(sunset ? { sunset } : {}),
      ...(day.uvIndex ? { uvMax: Number(day.uvIndex) } : {}),
    });
  }

  const hh = Number(now.slice(11, 13));
  const celsiusForecast: WeatherForecast = {
    now,
    current: {
      temp: Number(cur.temp_C ?? 0),
      feels: Number(cur.FeelsLikeC ?? cur.temp_C ?? 0),
      humidity: Number(cur.humidity ?? 0),
      wind: Number(cur.windspeedKmph ?? 0),
      code: wwoCodeToWmo(Number(cur.weatherCode ?? 116)),
      day: hh >= 6 && hh < 18 ? 1 : 0,
      mm: Number(cur.precipMM ?? 0),
      ...(cur.uvIndex ? { uv: Number(cur.uvIndex) } : {}),
    },
    hourly,
    daily,
    soon,
  };

  return convertForecastUnits(celsiusForecast, "celsius", units);
}
