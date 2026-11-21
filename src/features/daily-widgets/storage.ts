import { readJson, writeJson } from "../../lib/storage";

export const DAILY_WIDGETS_KEY = "fuyu-daily-widgets";
export const POMODORO_MS = 25 * 60_000;
export const KEEP_DAILY_DAYS = 70;

export type Pomodoro = { endsAt: number | null; leftMs: number };

export type DailyData = {
  water: Record<string, number>;
  habits: Record<string, number[]>;
  checkins: string[];
  focus: Record<string, number>;
  note: string;
  pomodoro: Pomodoro;
};

export const EMPTY_DAILY: DailyData = { water: {}, habits: {}, checkins: [], focus: {}, note: "", pomodoro: { endsAt: null, leftMs: POMODORO_MS } };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);

function numbers(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([day, amount]) => [day, count(amount)]).filter(([, amount]) => amount));
}

function habitDays(value: unknown): Record<string, number[]> {
  if (!isRecord(value)) return {};
  const entries = Object.entries(value).map(([day, done]) => [day, Array.isArray(done) ? done.filter((at): at is number => Number.isInteger(at) && at >= 0 && at < 3) : []] as const);
  return Object.fromEntries(entries.filter(([, done]) => done.length));
}

function pomodoro(value: unknown): Pomodoro {
  if (!isRecord(value)) return EMPTY_DAILY.pomodoro;
  const endsAt = typeof value.endsAt === "number" && Number.isFinite(value.endsAt) ? value.endsAt : null;
  const leftMs = count(value.leftMs);
  return { endsAt, leftMs: leftMs > 0 && leftMs <= POMODORO_MS ? leftMs : POMODORO_MS };
}

export function readDaily(): DailyData {
  const raw = readJson(DAILY_WIDGETS_KEY);
  if (!isRecord(raw) || raw.version !== 1) return EMPTY_DAILY;
  return {
    water: numbers(raw.water),
    habits: habitDays(raw.habits),
    checkins: Array.isArray(raw.checkins) ? raw.checkins.filter((day): day is string => typeof day === "string") : [],
    focus: numbers(raw.focus),
    note: typeof raw.note === "string" ? raw.note.slice(0, 2000) : "",
    pomodoro: pomodoro(raw.pomodoro),
  };
}

function recent<T>(days: Record<string, T>, oldest: string): Record<string, T> {
  return Object.fromEntries(Object.entries(days).filter(([day]) => day >= oldest));
}

export function writeDaily(data: DailyData, oldest: string): void {
  writeJson(DAILY_WIDGETS_KEY, {
    version: 1,
    water: recent(data.water, oldest),
    habits: recent(data.habits, oldest),
    checkins: data.checkins.filter((day) => day >= oldest),
    focus: recent(data.focus, oldest),
    note: data.note,
    pomodoro: data.pomodoro,
  });
}
