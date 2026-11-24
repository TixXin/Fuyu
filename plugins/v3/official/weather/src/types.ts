import type { WeatherConfig, WeatherSourceId } from "./config.ts";

export interface WeatherPlace {
  id?: string;
  name: string;
  region: string;
  country: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  nmcStationId?: string;
}

export interface WeatherCurrent {
  temp: number;
  feels: number;
  humidity: number;
  wind: number;
  code: number;
  day: number;
  mm: number;
  uv?: number;
}

export interface WeatherHour {
  time: string;
  temp: number;
  pop: number;
  code: number;
  day: number;
  wind?: number;
  uv?: number;
}

export interface WeatherDay {
  date: string;
  code: number;
  max: number;
  min: number;
  pop: number;
  sunrise?: string;
  sunset?: string;
  uvMax?: number;
}

export interface WeatherSoon {
  time: string;
  mm: number;
}

export interface WeatherAirQuality {
  usAqi: number;
  pm25: number | null;
  pm10: number | null;
  time: string;
}

export interface WeatherForecast {
  now: string;
  current: WeatherCurrent;
  hourly: WeatherHour[];
  daily: WeatherDay[];
  soon: WeatherSoon[];
}

export type WeatherProblem = { kind: "noPlace"; city: string } | { kind: "offline"; reason: string };

export interface WeatherState {
  config: WeatherConfig;
  activeCityId: string;
  place: WeatherPlace | null;
  forecast: WeatherForecast | null;
  aqi: WeatherAirQuality | null;
  fetchedAt: number | null;
  primaryPlace: WeatherPlace | null;
  primaryForecast: WeatherForecast | null;
  primaryAqi: WeatherAirQuality | null;
  sourceUsed: WeatherSourceId | null;
  fallbackFrom: WeatherSourceId | null;
  loading: boolean;
  problem: WeatherProblem | null;
  updatedAt: number;
}

export const METHODS = {
  getState: "getState",
  setConfig: "setConfig",
  refresh: "refresh",
  searchCities: "searchCities",
  addCity: "addCity",
  removeCity: "removeCity",
  setPrimaryCity: "setPrimaryCity",
  selectCity: "selectCity",
} as const;

export const TOPICS = {
  state: "state",
} as const;

export function formatTemp(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}°`;
}
