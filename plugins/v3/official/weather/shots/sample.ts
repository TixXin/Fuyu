import { DEFAULT_CONFIG } from "../src/config.ts";
import type { WeatherDay, WeatherHour, WeatherState } from "../src/types.ts";

const NOW = Date.parse("2026-11-19T10:24:00");

const HOURS: Array<[temp: number, pop: number, code: number]> = [
  [18, 10, 2],
  [19, 10, 2],
  [20, 15, 2],
  [21, 20, 3],
  [21, 35, 3],
  [20, 45, 61],
  [19, 40, 61],
  [18, 30, 3],
  [16, 20, 3],
  [15, 15, 2],
  [14, 10, 2],
  [14, 10, 1],
  [13, 5, 1],
  [13, 5, 0],
  [12, 5, 0],
  [12, 5, 0],
  [11, 5, 0],
  [11, 5, 1],
  [11, 10, 2],
  [11, 10, 2],
  [12, 15, 2],
  [13, 20, 3],
  [15, 30, 3],
  [16, 40, 3],
];

const hourly: WeatherHour[] = HOURS.map(([temp, pop, code], index) => {
  const hour = 10 + index;
  const date = hour < 24 ? "2026-11-19" : "2026-11-20";
  const clock = hour % 24;
  return {
    time: `${date}T${String(clock).padStart(2, "0")}:00`,
    temp,
    pop,
    code,
    day: clock >= 7 && clock < 17 ? 1 : 0,
  };
});

const daily: WeatherDay[] = [
  { date: "2026-11-19", code: 2, max: 21, min: 11, pop: 45 },
  { date: "2026-11-20", code: 61, max: 17, min: 12, pop: 70 },
  { date: "2026-11-21", code: 63, max: 14, min: 10, pop: 90 },
  { date: "2026-11-22", code: 3, max: 15, min: 9, pop: 35 },
  { date: "2026-11-23", code: 2, max: 16, min: 8, pop: 15 },
  { date: "2026-11-24", code: 0, max: 18, min: 7, pop: 5 },
  { date: "2026-11-25", code: 1, max: 19, min: 8, pop: 5 },
];

const state: WeatherState = {
  config: { ...DEFAULT_CONFIG, city: "杭州", showOnBar: true },
  place: { name: "杭州", region: "浙江", country: "中国", latitude: 30.2937, longitude: 120.1614 },
  forecast: {
    now: "2026-11-19T10:15",
    current: { temp: 18, feels: 17, humidity: 68, wind: 12, code: 2, day: 1, mm: 0 },
    hourly,
    daily,
    soon: [],
  },
  fetchedAt: NOW - 6 * 60 * 1000,
  loading: false,
  problem: null,
  updatedAt: NOW,
};

export default {
  now: NOW,
  host: {
    calls: {
      getState: state,
      refresh: state,
    },
  },
  shots: [
    { slot: "island.page/v1", file: "page.png" },
    { slot: "island.collapsed/v1", file: "bar.png" },
  ],
};
