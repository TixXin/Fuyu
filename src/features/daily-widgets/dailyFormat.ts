import { isCityId, type CityId } from "./cities.ts";
import { normalizeDateText } from "./countdowns.ts";

export const POMODORO_LENGTHS = [25, 45, 15, 60] as const;
export const DEFAULT_POMODORO_MINUTES = 25;
export const MAX_POMODORO_MS = 60 * 60_000;
export const MAX_HABITS = 4;
export const HABIT_NAME_MAX = 16;
export const MAX_COUNTDOWNS = 8;
export const COUNTDOWN_NAME_MAX = 24;
export const WORLD_CITY_SLOTS = 3;
export const WATER_GOALS = [8, 10, 12, 6] as const;
export const NOTE_MAX = 2000;

export type Pomodoro = { endsAt: number | null; leftMs: number; minutes: number };
export type CountdownEntry = { name: string; date: string };

export type DailyData = {
  water: Record<string, number>;
  habits: Record<string, number[]>;
  checkins: string[];
  focus: Record<string, number>;
  note: string;
  pomodoro: Pomodoro;
  habitNames: string[] | null;
  countdowns: CountdownEntry[];
  countdownAt: number;
  cities: CityId[] | null;
  sunCity: CityId | null;
  waterGoal: number;
};

export const EMPTY_DAILY: DailyData = {
  water: {},
  habits: {},
  checkins: [],
  focus: {},
  note: "",
  pomodoro: { endsAt: null, leftMs: DEFAULT_POMODORO_MINUTES * 60_000, minutes: DEFAULT_POMODORO_MINUTES },
  habitNames: null,
  countdowns: [],
  countdownAt: 0,
  cities: null,
  sunCity: null,
  waterGoal: WATER_GOALS[0],
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);
const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : null);

function numbers(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([day, amount]) => [day, count(amount)]).filter(([, amount]) => amount));
}

function habitDays(value: unknown): Record<string, number[]> {
  if (!isRecord(value)) return {};
  const entries = Object.entries(value).map(([day, done]) => [day, Array.isArray(done) ? done.filter((at): at is number => Number.isInteger(at) && at >= 0 && at < MAX_HABITS) : []] as const);
  return Object.fromEntries(entries.filter(([, done]) => done.length));
}

function pomodoro(value: unknown): Pomodoro {
  if (!isRecord(value)) return EMPTY_DAILY.pomodoro;
  const minutes = POMODORO_LENGTHS.find((length) => length === value.minutes) ?? DEFAULT_POMODORO_MINUTES;
  const endsAt = typeof value.endsAt === "number" && Number.isFinite(value.endsAt) ? value.endsAt : null;
  const leftMs = count(value.leftMs);
  return { endsAt, leftMs: leftMs > 0 && leftMs <= minutes * 60_000 ? leftMs : minutes * 60_000, minutes };
}

function habitNames(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const names = value.map((name) => text(name, HABIT_NAME_MAX)).filter((name): name is string => name !== null).slice(0, MAX_HABITS);
  return names.length ? names : null;
}

function countdowns(value: unknown): CountdownEntry[] {
  if (!Array.isArray(value)) return [];
  const entries = value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const date = typeof entry.date === "string" ? normalizeDateText(entry.date) : null;
    return date ? [{ name: text(entry.name, COUNTDOWN_NAME_MAX) ?? "", date }] : [];
  });
  return entries.slice(0, MAX_COUNTDOWNS);
}

function cities(value: unknown): CityId[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.filter(isCityId).slice(0, WORLD_CITY_SLOTS);
  return ids.length === WORLD_CITY_SLOTS ? ids : null;
}

export function parseDaily(raw: unknown): DailyData {
  if (!isRecord(raw) || raw.version !== 1) return EMPTY_DAILY;
  const list = countdowns(raw.countdowns);
  const at = typeof raw.countdownAt === "number" && Number.isInteger(raw.countdownAt) ? raw.countdownAt : 0;
  return {
    water: numbers(raw.water),
    habits: habitDays(raw.habits),
    checkins: Array.isArray(raw.checkins) ? raw.checkins.filter((day): day is string => typeof day === "string") : [],
    focus: numbers(raw.focus),
    note: text(raw.note, NOTE_MAX) ?? "",
    pomodoro: pomodoro(raw.pomodoro),
    habitNames: habitNames(raw.habitNames),
    countdowns: list,
    countdownAt: at >= 0 && at < list.length ? at : 0,
    cities: cities(raw.cities),
    sunCity: isCityId(raw.sunCity) ? raw.sunCity : null,
    waterGoal: WATER_GOALS.find((goal) => goal === raw.waterGoal) ?? EMPTY_DAILY.waterGoal,
  };
}

function recent<T>(days: Record<string, T>, oldest: string): Record<string, T> {
  return Object.fromEntries(Object.entries(days).filter(([day]) => day >= oldest));
}

export function serializeDaily(data: DailyData, oldest: string): Record<string, unknown> {
  return {
    version: 1,
    water: recent(data.water, oldest),
    habits: recent(data.habits, oldest),
    checkins: data.checkins.filter((day) => day >= oldest),
    focus: recent(data.focus, oldest),
    note: data.note,
    pomodoro: data.pomodoro,
    ...(data.habitNames ? { habitNames: data.habitNames } : {}),
    ...(data.countdowns.length ? { countdowns: data.countdowns, countdownAt: data.countdownAt } : {}),
    ...(data.cities ? { cities: data.cities } : {}),
    ...(data.sunCity ? { sunCity: data.sunCity } : {}),
    ...(data.waterGoal !== EMPTY_DAILY.waterGoal ? { waterGoal: data.waterGoal } : {}),
  };
}

export function withoutHabit(days: Record<string, number[]>, removed: number): Record<string, number[]> {
  const entries = Object.entries(days).map(([day, done]) => [day, done.filter((at) => at !== removed).map((at) => (at > removed ? at - 1 : at))] as const);
  return Object.fromEntries(entries.filter(([, done]) => done.length));
}
