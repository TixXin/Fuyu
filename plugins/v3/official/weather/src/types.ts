import type { WeatherConfig } from "./config.ts";

export interface WeatherPlace {
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface WeatherCurrent {
  temp: number;
  feels: number;
  humidity: number;
  wind: number;
  code: number;
  day: number;
  mm: number;
}

export interface WeatherHour {
  time: string;
  temp: number;
  pop: number;
  code: number;
  day: number;
}

export interface WeatherDay {
  date: string;
  code: number;
  max: number;
  min: number;
  pop: number;
}

export interface WeatherSoon {
  time: string;
  mm: number;
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
  place: WeatherPlace | null;
  forecast: WeatherForecast | null;
  fetchedAt: number | null;
  loading: boolean;
  problem: WeatherProblem | null;
  updatedAt: number;
}

export const METHODS = {
  getState: "getState",
  setConfig: "setConfig",
  refresh: "refresh",
} as const;

export const TOPICS = {
  state: "state",
} as const;

export function formatTemp(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}°`;
}
