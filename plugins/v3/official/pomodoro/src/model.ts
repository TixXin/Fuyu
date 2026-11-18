import type { Timer } from "@fuyu/plugin-services";

export const POMODORO_MS = 25 * 60_000;

export const METHODS = {
  snapshot: "snapshot",
  start: "start",
  stop: "stop",
} as const;

export const TOPICS = {
  snapshot: "snapshot",
} as const;

export type OpenTodoItem = {
  id: string;
  title: string;
};

export type PomodoroSnapshot = {
  timer: Timer | null;
  at: number;
  activeTodoId: string | null;
  activeLabel: string;
  rounds: number;
  openTodos: OpenTodoItem[];
};

export const EMPTY_SNAPSHOT: PomodoroSnapshot = {
  timer: null,
  at: 0,
  activeTodoId: null,
  activeLabel: "",
  rounds: 0,
  openTodos: [],
};

export function remainingMs(timer: Timer, at: number): number {
  const elapsed = timer.elapsedMs + (timer.runningSince === null ? 0 : Math.max(0, at - timer.runningSince));
  return Math.max(0, timer.durationMs - elapsed);
}

export function isTicking(timer: Timer | null, at: number): boolean {
  return timer !== null && timer.runningSince !== null && remainingMs(timer, at) > 0;
}

export function formatMs(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
