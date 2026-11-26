export type TemperatureUnit = "celsius" | "fahrenheit";
export type WindUnit = "kmh" | "ms" | "mph" | "bft";
export type TimeFormat = "system" | "24" | "12";
export type BarStyle = "icon" | "text" | "temp";
export type WeatherSourceId = "auto" | "nmc" | "open-meteo" | "open-meteo-cma" | "metno" | "wttr";

export const HOUR_CHOICES = [6, 12, 24] as const;
export const REFRESH_CHOICES = [30, 60, 90, 120, 180] as const;
export const LEAD_CHOICES = [30, 60, 120] as const;
export const WEATHER_SOURCES: readonly WeatherSourceId[] = [
  "auto",
  "nmc",
  "open-meteo",
  "open-meteo-cma",
  "metno",
  "wttr",
];
export const MAX_CITIES = 8;
export const CONFIG_VERSION = 3;

export interface SavedCity {
  id: string;
  query: string;
  name: string;
  region: string;
  country: string;
  countryCode?: string;
  timezone?: string;
  nmcStationId?: string;
  latitude: number | null;
  longitude: number | null;
}

export interface WeatherConfig {
  version: number;
  city: string;
  cities: SavedCity[];
  activeCityId: string;
  sample?: boolean;
  weatherSource: WeatherSourceId;
  autoFallback: boolean;
  units: TemperatureUnit;
  windUnit: WindUnit;
  timeFormat: TimeFormat;
  showFeels: boolean;
  showHumidity: boolean;
  showWind: boolean;
  showPop: boolean;
  showSunUv: boolean;
  showAqi: boolean;
  hours: number;
  showOnBar: boolean;
  barStyle: BarStyle;
  rainAlert: boolean;
  extremeAlert: boolean;
  rainLeadMinutes: number;
  quietHours: boolean;
  quietStart: string;
  quietEnd: string;
  refreshMinutes: number;
}

export const DEFAULT_CONFIG: WeatherConfig = {
  version: CONFIG_VERSION,
  city: "",
  cities: [],
  activeCityId: "",
  weatherSource: "auto",
  autoFallback: true,
  units: "celsius",
  windUnit: "kmh",
  timeFormat: "system",
  showFeels: true,
  showHumidity: false,
  showWind: false,
  showPop: true,
  showSunUv: false,
  showAqi: false,
  hours: 6,
  showOnBar: false,
  barStyle: "icon",
  rainAlert: false,
  extremeAlert: false,
  rainLeadMinutes: 60,
  quietHours: false,
  quietStart: "22:00",
  quietEnd: "07:00",
  refreshMinutes: 30,
};

type Raw = Record<string, unknown>;

export function coordsId(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

export function legacyCity(query: string): SavedCity {
  const clean = query.trim();
  return {
    id: `query:${clean.toLowerCase()}`,
    query: clean,
    name: clean,
    region: "",
    country: "",
    latitude: null,
    longitude: null,
  };
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function choice(value: unknown, allowed: readonly number[], fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return allowed.includes(n) ? n : fallback;
}

function refreshMinutes(value: unknown): number {
  const n = typeof value === "number" ? Math.round(value) : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_CONFIG.refreshMinutes;
  return Math.max(30, Math.min(180, Math.round(n)));
}

function clock(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return fallback;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return fallback;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optStr(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeCityItem(item: unknown): SavedCity | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const raw = item as Raw;
  const query = typeof raw.query === "string" ? raw.query.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : query;
  if (!name && !query) return null;
  const latitude = finiteNumber(raw.latitude);
  const longitude = finiteNumber(raw.longitude);
  const hasCoords =
    latitude !== null && longitude !== null && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : hasCoords
        ? coordsId(latitude, longitude)
        : `query:${(query || name).toLowerCase()}`;
  const countryCode = optStr(raw.countryCode);
  const timezone = optStr(raw.timezone);
  const nmcStationId = optStr(raw.nmcStationId);
  return {
    id,
    query: query || name,
    name: name || query,
    region: typeof raw.region === "string" ? raw.region.trim() : "",
    country: typeof raw.country === "string" ? raw.country.trim() : "",
    ...(countryCode ? { countryCode } : {}),
    ...(timezone ? { timezone } : {}),
    ...(nmcStationId ? { nmcStationId } : {}),
    latitude: hasCoords ? latitude : null,
    longitude: hasCoords ? longitude : null,
  };
}

function dedupeCities(list: SavedCity[]): SavedCity[] {
  const seen = new Set<string>();
  const out: SavedCity[] = [];
  for (const city of list) {
    if (seen.has(city.id)) continue;
    seen.add(city.id);
    out.push(city);
    if (out.length >= MAX_CITIES) break;
  }
  return out;
}

function resolveCities(raw: Raw, base: WeatherConfig): { cities: SavedCity[]; city: string; activeCityId: string } {
  let cities = base.cities.map((item) => ({ ...item }));
  if (Array.isArray(raw.cities)) {
    cities = dedupeCities(raw.cities.map(normalizeCityItem).filter((item): item is SavedCity => item !== null));
  } else if (typeof raw.city === "string") {
    const trimmed = raw.city.trim();
    if (!trimmed) {
      cities = [];
    } else if (cities.length === 0) {
      cities = [legacyCity(trimmed)];
    } else if (cities[0].query !== trimmed && cities[0].name !== trimmed) {
      cities = dedupeCities([legacyCity(trimmed), ...cities.slice(1)]);
    }
  }
  const primary = cities[0];
  const city = primary ? primary.query || primary.name : "";
  const wantedActive = typeof raw.activeCityId === "string" ? raw.activeCityId.trim() : base.activeCityId;
  const activeCityId = cities.some((item) => item.id === wantedActive) ? wantedActive : primary?.id ?? "";
  return { cities, city, activeCityId };
}

export const SAMPLE_CITY_ZH: SavedCity = {
  id: "30.2741,120.1551",
  query: "杭州",
  name: "杭州",
  region: "浙江",
  country: "中国",
  countryCode: "CN",
  timezone: "Asia/Shanghai",
  nmcStationId: "58457",
  latitude: 30.2741,
  longitude: 120.1551,
};

export const SAMPLE_CITY_EN: SavedCity = {
  id: "37.7749,-122.4194",
  query: "San Francisco",
  name: "San Francisco",
  region: "California",
  country: "United States",
  countryCode: "US",
  timezone: "America/Los_Angeles",
  latitude: 37.7749,
  longitude: -122.4194,
};

export function sampleCityFor(zh: boolean): SavedCity {
  return zh ? { ...SAMPLE_CITY_ZH } : { ...SAMPLE_CITY_EN };
}

export function normalizeConfig(raw: Raw, base: WeatherConfig = DEFAULT_CONFIG): WeatherConfig {
  const { cities, city, activeCityId } = resolveCities(raw, base);
  const sample =
    cities.length === 0
      ? false
      : typeof raw.sample === "boolean"
        ? raw.sample
        : Array.isArray(raw.cities) || typeof raw.city === "string"
          ? false
          : Boolean(base.sample);
  return {
    version: CONFIG_VERSION,
    city,
    cities,
    activeCityId,
    ...(sample ? { sample: true } : {}),
    weatherSource: pick(raw.weatherSource, WEATHER_SOURCES, base.weatherSource),
    autoFallback: flag(raw.autoFallback, base.autoFallback),
    units: pick(raw.units, ["celsius", "fahrenheit"], base.units),
    windUnit: pick(raw.windUnit, ["kmh", "ms", "mph", "bft"], base.windUnit),
    timeFormat: pick(raw.timeFormat, ["system", "24", "12"], base.timeFormat),
    showFeels: flag(raw.showFeels, base.showFeels),
    showHumidity: flag(raw.showHumidity, base.showHumidity),
    showWind: flag(raw.showWind, base.showWind),
    showPop: flag(raw.showPop, base.showPop),
    showSunUv: flag(raw.showSunUv, base.showSunUv),
    showAqi: flag(raw.showAqi, base.showAqi),
    hours: choice(raw.hours, HOUR_CHOICES, base.hours),
    showOnBar: flag(raw.showOnBar, base.showOnBar),
    barStyle: pick(raw.barStyle, ["icon", "text", "temp"], base.barStyle),
    rainAlert: flag(raw.rainAlert, base.rainAlert),
    extremeAlert: flag(raw.extremeAlert, base.extremeAlert),
    rainLeadMinutes: choice(raw.rainLeadMinutes, LEAD_CHOICES, base.rainLeadMinutes),
    quietHours: flag(raw.quietHours, base.quietHours),
    quietStart: clock(raw.quietStart, base.quietStart),
    quietEnd: clock(raw.quietEnd, base.quietEnd),
    refreshMinutes: raw.refreshMinutes === undefined ? base.refreshMinutes : refreshMinutes(raw.refreshMinutes),
  };
}

export function initialConfig(raw: unknown, zh: boolean): WeatherConfig {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return configFromStored(raw);
  const city = sampleCityFor(zh);
  return {
    ...DEFAULT_CONFIG,
    city: city.query,
    cities: [city],
    activeCityId: city.id,
    sample: true,
  };
}

export function configFromStored(raw: unknown): WeatherConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_CONFIG, cities: [] };
  const stored = raw as Raw;
  const config = normalizeConfig(stored);
  if (stored.version === CONFIG_VERSION || stored.version === 2) return config;
  const savedByUser = config.cities.length > 0;
  return {
    ...config,
    showOnBar: savedByUser ? flag(stored.showOnBar, true) : false,
    rainAlert: savedByUser ? flag(stored.rainAlert, true) : false,
  };
}
