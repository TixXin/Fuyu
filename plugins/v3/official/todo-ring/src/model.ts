export const METHODS = {
  progress: "progress",
  refresh: "refresh",
  complete: "complete",
} as const;

export const TOPICS = {
  progress: "progress",
} as const;

export type UpcomingTodo = {
  id: string;
  title: string;
  project?: string;
};

export type RingProgress = {
  done: number;
  total: number;
  next: UpcomingTodo[];
  at: number;
};

export const EMPTY_PROGRESS: RingProgress = {
  done: 0,
  total: 0,
  next: [],
  at: 0,
};

export function percentOf(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
}
