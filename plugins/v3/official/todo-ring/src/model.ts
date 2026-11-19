export const METHODS = {
  snapshot: "snapshot",
  complete: "complete",
  reopen: "reopen",
  setSettings: "set-settings",
} as const;

export const TOPICS = {
  snapshot: "snapshot",
} as const;

export const MAX_SHOWN = 8;
export const SHOW_COUNTS = [0, 3, 5, 8] as const;
export const OVERDUE_DAYS = 7;

export type ScopeMode = "today" | "overdue";
export type BarStyle = "ring-count" | "ring" | "left";

export type RingSettings = {
  showCount: number;
  clickToComplete: boolean;
  scope: ScopeMode;
  doneColor: boolean;
  showInBar: boolean;
  barStyle: BarStyle;
};

export const DEFAULT_SETTINGS: RingSettings = {
  showCount: 3,
  clickToComplete: false,
  scope: "today",
  doneColor: true,
  showInBar: true,
  barStyle: "ring-count",
};

const FLAGS = ["clickToComplete", "doneColor", "showInBar"] as const;
const CHOICES = {
  scope: ["today", "overdue"],
  barStyle: ["ring-count", "ring", "left"],
} as const;

export type UpcomingTodo = {
  id: string;
  title: string;
  project?: string;
  overdueFrom?: string;
};

export type RingProgress = {
  date: string;
  done: number;
  total: number;
  next: UpcomingTodo[];
};

export type RingSnapshot = RingProgress & {
  error: "unavailable" | null;
  settings: RingSettings;
  at: number;
};

export type DayTodos = {
  date: string;
  todos: readonly { id: string; title: string; completed: boolean; project?: string }[];
};

export const EMPTY_PROGRESS: RingProgress = { date: "", done: 0, total: 0, next: [] };

export function normalizeSettings(raw: unknown, base: RingSettings = DEFAULT_SETTINGS): RingSettings {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const next: RingSettings = { ...base };
  for (const key of FLAGS) {
    if (typeof source[key] === "boolean") next[key] = source[key];
  }
  for (const key of Object.keys(CHOICES) as (keyof typeof CHOICES)[]) {
    const value = source[key];
    if ((CHOICES[key] as readonly unknown[]).includes(value)) (next as Record<string, unknown>)[key] = value;
  }
  const count = source.showCount;
  if (typeof count === "number" && Number.isFinite(count)) {
    next.showCount = Math.max(0, Math.min(MAX_SHOWN, Math.trunc(count)));
  }
  return next;
}

export function normalizeStored(raw: unknown): RingSettings {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return normalizeSettings(source.settings);
}

export function percentOf(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
}

const titleKey = (title: string) => title.trim().toLowerCase();

export function buildProgress(today: DayTodos, past: readonly DayTodos[], scope: ScopeMode): RingProgress {
  const todos = Array.isArray(today.todos) ? today.todos : [];
  const pending: UpcomingTodo[] = todos
    .filter((item) => !item.completed)
    .map((item) => ({ id: item.id, title: item.title, ...(item.project ? { project: item.project } : {}) }));
  const done = todos.length - pending.length;
  if (scope !== "overdue") {
    return { date: today.date, done, total: todos.length, next: pending.slice(0, MAX_SHOWN) };
  }
  const seen = new Set(todos.map((item) => titleKey(item.title)));
  const overdue: UpcomingTodo[] = [];
  const days = [...past].filter((day) => day.date < today.date).sort((a, b) => a.date.localeCompare(b.date));
  for (const day of days) {
    for (const item of Array.isArray(day.todos) ? day.todos : []) {
      const key = titleKey(item.title);
      if (item.completed || seen.has(key)) continue;
      seen.add(key);
      overdue.push({ id: item.id, title: item.title, ...(item.project ? { project: item.project } : {}), overdueFrom: day.date });
    }
  }
  return {
    date: today.date,
    done,
    total: todos.length + overdue.length,
    next: [...overdue, ...pending].slice(0, MAX_SHOWN),
  };
}

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d + days));
  return at.toISOString().slice(0, 10);
}

export function msUntilNextDay(now: number): number {
  const at = new Date(now);
  const next = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1, 0, 0, 1);
  return Math.max(1000, next.getTime() - now);
}
