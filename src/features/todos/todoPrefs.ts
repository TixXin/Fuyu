import { getLocalDateString } from "../../utils/date.ts";
import { addDays } from "./schedule.ts";
import type { TodoItem, TodoPriority } from "./types.ts";

export type TodoSortBy = "manual" | "priority" | "createdDesc";
export type TodoInsertPosition = "bottom" | "top";
export type TodoDayStartHour = 0 | 2 | 3 | 4 | 5 | 6;
export type TodoDoneDisplay = "fold" | "inline" | "hide";
export type TodoArchiveRetentionDays = 0 | 90 | 180 | 365;

export type TodoPrefs = {
  showElapsed: boolean;
  sortBy: TodoSortBy;
  inlineSyntax: boolean;
  insertPosition: TodoInsertPosition;
  completionSound: boolean;
  dayStartHour: TodoDayStartHour;
  doneDisplay: TodoDoneDisplay;
  markdownPriority: boolean;
  markdownElapsed: boolean;
  archiveRetentionDays: TodoArchiveRetentionDays;
};

export const TODO_SORT_MODES: readonly TodoSortBy[] = ["manual", "priority", "createdDesc"];
export const TODO_INSERT_POSITIONS: readonly TodoInsertPosition[] = ["bottom", "top"];
export const TODO_DAY_START_HOURS: readonly TodoDayStartHour[] = [0, 2, 3, 4, 5, 6];
export const TODO_DONE_DISPLAYS: readonly TodoDoneDisplay[] = ["fold", "inline", "hide"];
export const TODO_ARCHIVE_RETENTION_DAYS: readonly TodoArchiveRetentionDays[] = [0, 90, 180, 365];

export const DEFAULT_TODO_PREFS: TodoPrefs = {
  showElapsed: true,
  sortBy: "manual",
  inlineSyntax: true,
  insertPosition: "bottom",
  completionSound: true,
  dayStartHour: 0,
  doneDisplay: "fold",
  markdownPriority: true,
  markdownElapsed: false,
  archiveRetentionDays: 0,
};

const MIN_REAL_TIMESTAMP_MS = 946_684_800_000;

function pickOne<T>(allowed: readonly T[], value: unknown, fallback: T): T {
  return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeTodoPrefs(value: unknown): TodoPrefs {
  const saved = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    showElapsed: pickBoolean(saved.showElapsed, DEFAULT_TODO_PREFS.showElapsed),
    sortBy: pickOne(TODO_SORT_MODES, saved.sortBy, DEFAULT_TODO_PREFS.sortBy),
    inlineSyntax: pickBoolean(saved.inlineSyntax, DEFAULT_TODO_PREFS.inlineSyntax),
    insertPosition: pickOne(TODO_INSERT_POSITIONS, saved.insertPosition, DEFAULT_TODO_PREFS.insertPosition),
    completionSound: pickBoolean(saved.completionSound, DEFAULT_TODO_PREFS.completionSound),
    dayStartHour: pickOne(TODO_DAY_START_HOURS, saved.dayStartHour, DEFAULT_TODO_PREFS.dayStartHour),
    doneDisplay: pickOne(TODO_DONE_DISPLAYS, saved.doneDisplay, DEFAULT_TODO_PREFS.doneDisplay),
    markdownPriority: pickBoolean(saved.markdownPriority, DEFAULT_TODO_PREFS.markdownPriority),
    markdownElapsed: pickBoolean(saved.markdownElapsed, DEFAULT_TODO_PREFS.markdownElapsed),
    archiveRetentionDays: pickOne(TODO_ARCHIVE_RETENTION_DAYS, saved.archiveRetentionDays, DEFAULT_TODO_PREFS.archiveRetentionDays),
  };
}

export function getLogicalTodoDate(now: Date = new Date(), dayStartHour = 0): string {
  const boundary = Number.isFinite(dayStartHour) ? Math.max(0, Math.min(23, Math.trunc(dayStartHour))) : 0;
  if (boundary > 0 && now.getHours() < boundary) {
    return getLocalDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0, 0, 0));
  }
  return getLocalDateString(now);
}

function priorityRank(priority: TodoPriority | undefined): number {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  if (priority === "low") return 2;
  return 3;
}

export function sortTodos<T extends Pick<TodoItem, "priority" | "createdAt">>(todos: readonly T[], sortBy: TodoSortBy): T[] {
  if (sortBy === "manual") return [...todos];
  const indexed = todos.map((todo, index) => ({ todo, index }));
  if (sortBy === "priority") {
    indexed.sort((left, right) => priorityRank(left.todo.priority) - priorityRank(right.todo.priority) || left.index - right.index);
  } else {
    indexed.sort((left, right) => right.todo.createdAt - left.todo.createdAt || left.index - right.index);
  }
  return indexed.map((entry) => entry.todo);
}

export function insertTodoItem<T>(todos: readonly T[], item: T, position: TodoInsertPosition): T[] {
  return position === "top" ? [item, ...todos] : [...todos, item];
}

export function formatElapsedMinutes(startedAt: number, now: number = Date.now()): string {
  if (!Number.isFinite(startedAt) || !Number.isFinite(now)) return "";
  const totalMinutes = Math.max(0, Math.floor((now - startedAt) / 60_000));
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function todoElapsedLabel(startedAt: number | undefined, now: number, showElapsed: boolean): string | null {
  if (!showElapsed || typeof startedAt !== "number" || !Number.isFinite(startedAt)) return null;
  if (now >= MIN_REAL_TIMESTAMP_MS && startedAt < MIN_REAL_TIMESTAMP_MS) return null;
  return formatElapsedMinutes(startedAt, now) || null;
}

export function filterArchivesByRetention<T extends { date: string }>(
  archives: readonly T[],
  today: string,
  retentionDays: TodoArchiveRetentionDays,
): T[] {
  if (retentionDays <= 0) return [...archives];
  const cutoff = addDays(today, -retentionDays);
  return archives.filter((archive) => archive.date >= cutoff);
}

type AudioContextCtor = typeof AudioContext;
let sharedAudioContext: AudioContext | null = null;

export function playTodoCompleteSound(): void {
  try {
    const g = globalThis as typeof globalThis & { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
    const Ctor = g.AudioContext ?? g.webkitAudioContext;
    if (!Ctor) return;
    if (!sharedAudioContext || sharedAudioContext.state === "closed") {
      sharedAudioContext = new Ctor();
    }
    const ctx = sharedAudioContext;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }
    const start = ctx.currentTime;
    const notes: readonly { freq: number; offset: number; duration: number; peak: number }[] = [
      { freq: 880, offset: 0, duration: 0.065, peak: 0.065 },
      { freq: 1318.51, offset: 0.048, duration: 0.11, peak: 0.08 },
    ];
    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = start + note.offset;
      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(note.peak, at + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + note.duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + note.duration + 0.005);
    }
  } catch {
    return;
  }
}
