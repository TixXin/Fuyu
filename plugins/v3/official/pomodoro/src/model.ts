import type { Timer } from "@fuyu/plugin-services";

export const METHODS = {
  snapshot: "snapshot",
  start: "start",
  startBreak: "start-break",
  pause: "pause",
  resume: "resume",
  stop: "stop",
  setSettings: "set-settings",
} as const;

export const TOPICS = {
  snapshot: "snapshot",
  chime: "chime",
} as const;

export type Phase = "focus" | "short" | "long";
export type BreakKind = "short" | "long";

export type PomodoroSettings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  roundsBeforeLong: number;
  autoStartBreak: boolean;
  autoStartFocus: boolean;
  sound: boolean;
  dailyGoal: number;
  todosExpanded: boolean;
  showInBar: boolean;
};

export const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  roundsBeforeLong: 4,
  autoStartBreak: false,
  autoStartFocus: false,
  sound: false,
  dailyGoal: 0,
  todosExpanded: false,
  showInBar: false,
};

export const LIMITS = {
  focusMinutes: [1, 120],
  shortBreakMinutes: [1, 60],
  longBreakMinutes: [1, 90],
  roundsBeforeLong: [1, 12],
  dailyGoal: [0, 48],
} as const satisfies Record<string, readonly [number, number]>;

type NumberKey = keyof typeof LIMITS;
const NUMBER_KEYS = Object.keys(LIMITS) as NumberKey[];
const FLAG_KEYS = ["autoStartBreak", "autoStartFocus", "sound", "todosExpanded", "showInBar"] as const;

export type StoredPomodoro = PomodoroSettings & {
  date: string;
  rounds: number;
  streak: number;
  phase: Phase | null;
  activeTimerId: string | null;
  activeTodoId: string | null;
  activeLabel: string;
  breakDue: BreakKind | null;
  lastTodoId: string | null;
};

export type OpenTodoItem = {
  id: string;
  title: string;
};

export type PomodoroSnapshot = {
  timer: Timer | null;
  at: number;
  phase: Phase | null;
  activeTodoId: string | null;
  activeLabel: string;
  rounds: number;
  breakDue: BreakKind | null;
  openTodos: OpenTodoItem[];
  settings: PomodoroSettings;
};

export const EMPTY_SNAPSHOT: PomodoroSnapshot = {
  timer: null,
  at: 0,
  phase: null,
  activeTodoId: null,
  activeLabel: "",
  rounds: 0,
  breakDue: null,
  openTodos: [],
  settings: DEFAULT_SETTINGS,
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isPhase = (value: unknown): value is Phase => value === "focus" || value === "short" || value === "long";
const isBreak = (value: unknown): value is BreakKind => value === "short" || value === "long";
const stringOrNull = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);

function clampInt(value: unknown, [min, max]: readonly [number, number], fallback: number): number {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

export function normalizeSettings(raw: unknown, base: PomodoroSettings = DEFAULT_SETTINGS): PomodoroSettings {
  const source = isRecord(raw) ? raw : {};
  const next = { ...base };
  for (const key of NUMBER_KEYS) next[key] = clampInt(source[key], LIMITS[key], base[key]);
  for (const key of FLAG_KEYS) if (typeof source[key] === "boolean") next[key] = source[key];
  return next;
}

export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function normalizeStored(raw: unknown, today = todayKey()): StoredPomodoro {
  const source = isRecord(raw) ? raw : {};
  const sameDay = source.date === today;
  const activeTimerId = stringOrNull(source.activeTimerId);
  return {
    ...normalizeSettings(source),
    date: today,
    rounds: sameDay ? clampInt(source.rounds, [0, 999], 0) : 0,
    streak: sameDay ? clampInt(source.streak, [0, 999], 0) : 0,
    phase: activeTimerId ? (isPhase(source.phase) ? source.phase : "focus") : null,
    activeTimerId,
    activeTodoId: activeTimerId ? stringOrNull(source.activeTodoId) : null,
    activeLabel: activeTimerId && typeof source.activeLabel === "string" ? source.activeLabel : "",
    breakDue: sameDay && isBreak(source.breakDue) ? source.breakDue : null,
    lastTodoId: stringOrNull(source.lastTodoId),
  };
}

export function settingsOf(stored: StoredPomodoro): PomodoroSettings {
  const settings = {} as PomodoroSettings;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof PomodoroSettings)[]) {
    (settings as Record<string, unknown>)[key] = stored[key];
  }
  return settings;
}

export function nextBreak(streak: number, settings: PomodoroSettings): BreakKind {
  return streak > 0 && streak % settings.roundsBeforeLong === 0 ? "long" : "short";
}

export function phaseMinutes(phase: Phase, settings: PomodoroSettings): number {
  if (phase === "short") return settings.shortBreakMinutes;
  if (phase === "long") return settings.longBreakMinutes;
  return settings.focusMinutes;
}

export function remainingMs(timer: Timer, at: number): number {
  const elapsed = timer.elapsedMs + (timer.runningSince === null ? 0 : Math.max(0, at - timer.runningSince));
  return Math.max(0, timer.durationMs - elapsed);
}

export function isTicking(timer: Timer | null, at: number): boolean {
  return timer !== null && timer.runningSince !== null && remainingMs(timer, at) > 0;
}

export function isPaused(timer: Timer | null, at: number): boolean {
  return timer !== null && timer.runningSince === null && remainingMs(timer, at) > 0;
}

export function formatMs(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function msUntilNextDay(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return Math.max(1000, next.getTime() - now.getTime());
}
