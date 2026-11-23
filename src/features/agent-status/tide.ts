import { readJson, writeJson } from "../../lib/storage.ts";
import type { AgentSessionSummary } from "./api";

export const TIDE_STORAGE_KEY = "fuyu-agent-tide";
export const TIDE_SLOTS = 96;
export const TIDE_SLOT_MINUTES = 15;
const MAX_SESSIONS = 400;

export type TideGroup = "claude" | "codex" | "other";
export const TIDE_GROUPS: readonly TideGroup[] = ["claude", "codex", "other"];

export type TideDay = {
  day: string;
  slots: Record<TideGroup, number[]>;
  sessions: Record<TideGroup, string[]>;
  lastActiveAt: number | null;
};

export function tideDayKey(now: number): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function tideSlot(now: number): number {
  const date = new Date(now);
  return Math.min(TIDE_SLOTS - 1, Math.floor((date.getHours() * 60 + date.getMinutes()) / TIDE_SLOT_MINUTES));
}

export function emptyTide(day: string): TideDay {
  return {
    day,
    slots: { claude: Array(TIDE_SLOTS).fill(0), codex: Array(TIDE_SLOTS).fill(0), other: Array(TIDE_SLOTS).fill(0) },
    sessions: { claude: [], codex: [], other: [] },
    lastActiveAt: null,
  };
}

export function tideGroup(provider: string): TideGroup {
  return provider === "claudeCode" ? "claude" : provider === "codex" ? "codex" : "other";
}

function counts(value: unknown): number[] {
  const list = Array.isArray(value) ? value : [];
  return Array.from({ length: TIDE_SLOTS }, (_, index) => {
    const count = list[index];
    return typeof count === "number" && Number.isFinite(count) && count > 0 ? Math.min(99, Math.round(count)) : 0;
  });
}

function ids(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))].slice(-MAX_SESSIONS) : [];
}

export function normalizeTide(value: unknown, today: string): TideDay {
  if (!value || typeof value !== "object") return emptyTide(today);
  const saved = value as Partial<Record<keyof TideDay, unknown>>;
  if (saved.day !== today) return emptyTide(today);
  const slots = (saved.slots ?? {}) as Partial<Record<TideGroup, unknown>>;
  const sessions = (saved.sessions ?? {}) as Partial<Record<TideGroup, unknown>>;
  return {
    day: today,
    slots: { claude: counts(slots.claude), codex: counts(slots.codex), other: counts(slots.other) },
    sessions: { claude: ids(sessions.claude), codex: ids(sessions.codex), other: ids(sessions.other) },
    lastActiveAt: typeof saved.lastActiveAt === "number" && Number.isFinite(saved.lastActiveAt) ? saved.lastActiveAt : null,
  };
}

export function recordTide(tide: TideDay, sessions: readonly AgentSessionSummary[], now: number): TideDay {
  const today = tideDayKey(now);
  const base = tide.day === today ? tide : emptyTide(today);
  const running = sessions.filter((session) => session.phase === "running");
  if (running.length === 0) return base;
  const slot = tideSlot(now);
  const next: TideDay = { ...base, slots: { ...base.slots }, sessions: { ...base.sessions }, lastActiveAt: now };
  let changed = base !== tide;
  for (const group of TIDE_GROUPS) {
    const members = running.filter((session) => tideGroup(session.provider) === group);
    if (members.length === 0) continue;
    if (members.length > base.slots[group][slot]) {
      next.slots[group] = base.slots[group].map((count, index) => (index === slot ? members.length : count));
      changed = true;
    }
    const fresh = members.map((session) => session.sessionId).filter((id) => !base.sessions[group].includes(id));
    if (fresh.length > 0) {
      next.sessions[group] = [...base.sessions[group], ...fresh].slice(-MAX_SESSIONS);
      changed = true;
    }
  }
  const minute = (time: number | null) => (time === null ? null : Math.floor(time / 60_000));
  return changed || minute(base.lastActiveAt) !== minute(now) ? next : base;
}

export function tideMinutes(tide: TideDay, group: TideGroup): number {
  return tide.slots[group].filter((count) => count > 0).length * TIDE_SLOT_MINUTES;
}

export function loadTide(now: number): TideDay {
  return normalizeTide(readJson(TIDE_STORAGE_KEY), tideDayKey(now));
}

export function saveTide(tide: TideDay): void {
  writeJson(TIDE_STORAGE_KEY, tide);
}

export function tideArea(counts: readonly number[], width: number, base: number, amplitude: number, cap = 3): string | null {
  if (!counts.some((count) => count > 0)) return null;
  const step = width / counts.length;
  const round = (value: number) => Math.round(value * 10) / 10;
  let x = 0;
  let y = base;
  let path = `M0 ${base}`;
  counts.forEach((count, index) => {
    const nextX = (index + 0.5) * step;
    const nextY = base - (Math.min(count, cap) / cap) * amplitude;
    path += `C${round(x + step / 2)} ${round(y)} ${round(nextX - step / 2)} ${round(nextY)} ${round(nextX)} ${round(nextY)}`;
    x = nextX;
    y = nextY;
  });
  return `${path}C${round(x + step / 2)} ${round(y)} ${round(width)} ${base} ${round(width)} ${base}Z`;
}
