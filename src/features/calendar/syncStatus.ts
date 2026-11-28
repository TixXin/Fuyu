import type { CalendarProblem, CalendarSnapshot } from "./api";

export const SYNCING_CODE = "calendar.syncing";

export function isSyncing(problem: CalendarProblem): boolean {
  return typeof problem.message === "object" && problem.message.code === SYNCING_CODE;
}

export function failedProblems(snapshot: Pick<CalendarSnapshot, "problems">): CalendarProblem[] {
  return snapshot.problems.filter((problem) => !isSyncing(problem));
}

export function onlySyncing(snapshot: Pick<CalendarSnapshot, "problems" | "events">): boolean {
  return snapshot.events.length === 0 && snapshot.problems.length > 0 && snapshot.problems.every(isSyncing);
}

export type SourceSync =
  | { state: "failed"; problem: CalendarProblem; syncedAt: number | null }
  | { state: "syncing"; syncedAt: number | null }
  | { state: "synced"; syncedAt: number }
  | { state: "waiting" };

export function sourceSync(snapshot: Pick<CalendarSnapshot, "problems" | "synced"> | null, sourceId: string): SourceSync {
  if (!snapshot) return { state: "waiting" };
  const syncedAt = snapshot.synced?.[sourceId] ?? null;
  const problem = snapshot.problems.find((item) => item.sourceId === sourceId);
  if (problem) return isSyncing(problem) ? { state: "syncing", syncedAt } : { state: "failed", problem, syncedAt };
  return syncedAt === null ? { state: "waiting" } : { state: "synced", syncedAt };
}

export function refreshMinutes(snapshot: Pick<CalendarSnapshot, "refreshEveryMs"> | null): number {
  const every = snapshot?.refreshEveryMs;
  return typeof every === "number" && every > 0 ? Math.round(every / 60_000) : 15;
}

export function syncTime(ms: number, now: number): string {
  const date = new Date(ms);
  const today = new Date(now);
  const clock = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const sameDay = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  return sameDay ? clock : `${date.getMonth() + 1}/${date.getDate()} ${clock}`;
}
