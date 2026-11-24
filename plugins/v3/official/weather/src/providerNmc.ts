import type { HttpFetch } from "@fuyu/plugin-base";
import type { TemperatureUnit } from "./config.ts";
import { convertForecastUnits } from "./format.ts";
import { REQUEST_TIMEOUT_MS } from "./openMeteo.ts";
import type { WeatherAirQuality, WeatherDay, WeatherForecast, WeatherPlace } from "./types.ts";

const USER_AGENT = "FuyuWeather/1.4 (fuyu-desktop)";
const NMC_HEADERS = { Accept: "application/json", "User-Agent": USER_AGENT, Referer: "https://www.nmc.cn/" };

interface NmcProvince {
  code: string;
  name: string;
}

interface NmcStation {
  code: string;
  province: string;
  city: string;
}

interface NmcWeatherBody {
  data?: {
    real?: {
      publish_time?: string;
      weather?: {
        temperature?: number;
        feelst?: number;
        humidity?: number;
        rain?: number;
        info?: string;
      };
      wind?: { speed?: number };
      sunriseSunset?: { sunrise?: string; sunset?: string };
    };
    predict?: {
      detail?: Array<{
        date?: string;
        precipitation?: number;
        day?: { weather?: { info?: string; temperature?: string } };
        night?: { weather?: { info?: string; temperature?: string } };
      }>;
    };
    air?: {
      aqi?: number;
      forecasttime?: string;
    };
  };
}

const provinceCache: { list: NmcProvince[] | null } = { list: null };
const stationsByProvince = new Map<string, NmcStation[]>();

function timeoutSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }
  return undefined;
}

async function nmcJson<T>(url: string, fetcher: HttpFetch): Promise<T> {
  const signal = timeoutSignal();
  const init: Record<string, unknown> = { headers: NMC_HEADERS };
  if (signal) init.signal = signal;
  const response = await fetcher(url, init);
  if (!response.ok) throw new Error(`NMC HTTP ${response.status}`);
  return (await response.json()) as T;
}

function stripSuffix(name: string): string {
  return name.trim().replace(/(?:省|市|自治区|特别行政区|自治州|地区|盟|自治县|自治旗|县|区|旗)$/, "");
}

function validNum(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n >= 999 || n <= -999) return null;
  return n;
}

function validText(value: unknown): string {
  if (typeof value !== "string") return "";
  const s = value.trim();
  return !s || s === "-" || s === "9999" ? "" : s;
}

export function nmcTextToWmo(info: string): number {
  const s = info.trim();
  if (!s) return 2;
  if (s.includes("冰雹")) return 96;
  if (s.includes("雷")) return 95;
  if (s.includes("冻雨")) return 66;
  if (s.includes("暴雪") || s.includes("大雪")) return 75;
  if (s.includes("中雪")) return 73;
  if (s.includes("阵雪")) return 85;
  if (s.includes("雪")) return 71;
  if (s.includes("暴雨") || s.includes("大雨")) return 65;
  if (s.includes("强阵雨")) return 82;
  if (s.includes("阵雨")) return 80;
  if (s.includes("中雨")) return 63;
  if (s.includes("毛毛雨")) return 51;
  if (s.includes("雨")) return 61;
  if (s.includes("雾") || s.includes("霾") || s.includes("沙") || s.includes("尘")) return 45;
  if (s.includes("阴")) return 3;
  if (s.includes("多云")) return 2;
  if (s.includes("晴")) return 0;
  return 2;
}

async function getProvinces(fetcher: HttpFetch): Promise<NmcProvince[]> {
  if (provinceCache.list) return provinceCache.list;
  const list = await nmcJson<NmcProvince[]>("https://www.nmc.cn/rest/province", fetcher);
  if (Array.isArray(list) && list.length > 0) provinceCache.list = list;
  return provinceCache.list ?? [];
}

async function getStations(provinceCode: string, fetcher: HttpFetch): Promise<NmcStation[]> {
  const cached = stationsByProvince.get(provinceCode);
  if (cached) return cached;
  const list = await nmcJson<NmcStation[]>(`https://www.nmc.cn/rest/province/${provinceCode}`, fetcher);
  if (Array.isArray(list) && list.length > 0) stationsByProvince.set(provinceCode, list);
  return list ?? [];
}

function matchStation(stations: NmcStation[], cityName: string): NmcStation | null {
  const clean = stripSuffix(cityName);
  return (
    stations.find((item) => item.city === cityName || item.city === clean) ??
    stations.find((item) => stripSuffix(item.city) === clean) ??
    stations.find((item) => item.city.includes(clean) || clean.includes(item.city)) ??
    null
  );
}

export async function findNmcStation(place: WeatherPlace, fetcher: HttpFetch): Promise<string | null> {
  if (place.nmcStationId) return place.nmcStationId;
  const provinces = await getProvinces(fetcher);
  const regionClean = stripSuffix(place.region || place.name);
  const matchedProvs = provinces.filter((p) => {
    const pClean = stripSuffix(p.name);
    return regionClean !== "" && (pClean.includes(regionClean) || regionClean.includes(pClean));
  });
  const candidates = matchedProvs.length > 0 ? matchedProvs : provinces.filter((p) => stripSuffix(p.name) === stripSuffix(place.name));
  for (const prov of candidates) {
    const stations = await getStations(prov.code, fetcher);
    const hit = matchStation(stations, place.name);
    if (hit) return hit.code;
  }
  return null;
}

function toIsoClock(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(raw.trim());
  return match ? `${match[1]}T${match[2]}` : undefined;
}

function isDayNow(isoNow: string, sunrise?: string, sunset?: string): number {
  const hh = Number(isoNow.slice(11, 13));
  const sr = sunrise ? Number(sunrise.slice(11, 13)) : 6;
  const ss = sunset ? Number(sunset.slice(11, 13)) : 18;
  return Number.isFinite(hh) && hh >= sr && hh < ss ? 1 : 0;
}

export async function fetchNmc(
  place: WeatherPlace,
  units: TemperatureUnit,
  fetcher: HttpFetch,
): Promise<{ forecast: WeatherForecast; stationId: string; aqi: WeatherAirQuality | null }> {
  const stationId = await findNmcStation(place, fetcher);
  if (!stationId) throw new Error("NMC station not found");

  const body = await nmcJson<NmcWeatherBody>(`https://www.nmc.cn/rest/weather?stationid=${encodeURIComponent(stationId)}`, fetcher);
  const data = body.data;
  const real = data?.real;
  const temp = validNum(real?.weather?.temperature);
  if (temp === null) throw new Error("NMC empty observation");

  const now = toIsoClock(real?.publish_time) ?? new Date().toISOString().slice(0, 16);
  const todayDate = now.slice(0, 10);
  const sunrise = toIsoClock(real?.sunriseSunset?.sunrise);
  const sunset = toIsoClock(real?.sunriseSunset?.sunset);

  const rawDetails = Array.isArray(data?.predict?.detail) ? data.predict.detail : [];
  const filtered = rawDetails.filter((d) => typeof d.date === "string" && d.date >= todayDate);
  const useDetails = filtered.length > 0 ? filtered : rawDetails;

  const daily: WeatherDay[] = [];
  for (let i = 0; i < Math.min(7, useDetails.length); i += 1) {
    const item = useDetails[i];
    if (!item.date) continue;
    const dayTemp = validNum(item.day?.weather?.temperature);
    const nightTemp = validNum(item.night?.weather?.temperature);
    const temps = [dayTemp, nightTemp].filter((n): n is number => n !== null);
    const max = temps.length > 0 ? Math.max(...temps) : temp;
    const min = temps.length > 0 ? Math.min(...temps) : temp;
    const info = validText(item.day?.weather?.info) || validText(item.night?.weather?.info);
    const precip = validNum(item.precipitation) ?? 0;
    daily.push({
      date: item.date,
      code: nmcTextToWmo(info),
      max,
      min,
      pop: precip > 0 ? Math.min(95, Math.max(30, Math.round(precip * 15))) : 0,
      ...(i === 0 && sunrise ? { sunrise } : {}),
      ...(i === 0 && sunset ? { sunset } : {}),
    });
  }

  const realInfo = validText(real?.weather?.info);
  const fallbackInfo =
    validText(useDetails[0]?.day?.weather?.info) || validText(useDetails[0]?.night?.weather?.info);
  const windMs = validNum(real?.wind?.speed) ?? 0;
  const aqiVal = validNum(data?.air?.aqi);

  const celsiusForecast: WeatherForecast = {
    now,
    current: {
      temp,
      feels: validNum(real?.weather?.feelst) ?? temp,
      humidity: validNum(real?.weather?.humidity) ?? 0,
      wind: Math.round(windMs * 3.6 * 10) / 10,
      code: nmcTextToWmo(realInfo || fallbackInfo),
      day: isDayNow(now, sunrise, sunset),
      mm: validNum(real?.weather?.rain) ?? 0,
    },
    hourly: [],
    daily,
    soon: [],
  };

  return {
    forecast: convertForecastUnits(celsiusForecast, "celsius", units),
    stationId,
    aqi:
      aqiVal !== null
        ? { usAqi: Math.round(aqiVal), pm25: null, pm10: null, time: String(data?.air?.forecasttime ?? now) }
        : null,
  };
}
