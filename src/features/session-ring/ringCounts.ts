import type { AgentSessionEntry } from "@fuyu/plugin-services";
import type { SessionRingText } from "../../i18n/sections/sessionRing";
import { sessionProject } from "../../lib/agent-sessions/project.ts";

export type RingSegment = { value: number; color: string };

export type SessionRingState = "needs" | "yourturn" | "working" | "stale" | "done";

export type SessionRingCounts = Record<SessionRingState, number> & { total: number };

export const SESSION_RING_STATES: readonly { key: SessionRingState; color: string }[] = [
  { key: "needs", color: "#FF453A" },
  { key: "yourturn", color: "#FFD60A" },
  { key: "working", color: "#34C759" },
  { key: "stale", color: "rgba(52, 199, 89, 0.45)" },
  { key: "done", color: "#8E8E93" },
];

export type RingSession = Pick<AgentSessionEntry, "key" | "sessionId" | "title" | "cwd" | "light" | "unseen">;

const LIGHT_STATES: Readonly<Record<string, SessionRingState>> = { needs: "needs", failed: "needs", yourTurn: "yourturn", working: "working", stale: "stale", done: "done" };
const ASKING = new Set(["needs", "yourTurn", "failed"]);

export function sessionRingState({ light, unseen }: RingSession): SessionRingState {
  if (!unseen && ASKING.has(light)) return "done";
  return LIGHT_STATES[light] ?? "done";
}

export function ringSessions(sessions: readonly AgentSessionEntry[]): AgentSessionEntry[] {
  return sessions.filter((session) => session.listed);
}

export function sessionRingCounts(sessions: readonly RingSession[]): SessionRingCounts {
  const counts: SessionRingCounts = { needs: 0, yourturn: 0, working: 0, stale: 0, done: 0, total: 0 };
  for (const session of sessions) {
    counts[sessionRingState(session)] += 1;
    counts.total += 1;
  }
  return counts;
}

export const SESSION_GRID_MAX = 9;

export type SessionGridCell = SessionRingState | "more";

export function sessionGridCells(counts: SessionRingCounts): SessionGridCell[] {
  const cells: SessionGridCell[] = SESSION_RING_STATES.flatMap(({ key }) => Array<SessionRingState>(counts[key]).fill(key));
  return cells.length > SESSION_GRID_MAX ? [...cells.slice(0, SESSION_GRID_MAX - 1), "more"] : cells;
}

export const SESSION_SIGNAL_MAX = 7;

export type SessionSignalColumn = { key: SessionRingState; bars: SessionRingState[] };

const SIGNAL_COLUMNS: readonly SessionRingState[][] = [["done"], ["working", "stale"], ["yourturn"], ["needs"]];

export function sessionSignal(counts: SessionRingCounts): { columns: SessionSignalColumn[]; slots: number; bar: 2 | 3 } {
  const columns = SIGNAL_COLUMNS.map((states) => ({
    key: states[0],
    bars: states.flatMap((state) => Array<SessionRingState>(counts[state]).fill(state)).slice(0, SESSION_SIGNAL_MAX),
  })).filter(({ bars }) => bars.length > 0);
  const tallest = Math.max(0, ...columns.map(({ bars }) => bars.length));
  const slots = Math.max(5, tallest);
  return { columns, slots, bar: slots === 5 ? 3 : 2 };
}

export function sessionRingSegments(counts: SessionRingCounts): RingSegment[] {
  return SESSION_RING_STATES.filter(({ key }) => counts[key] > 0).map(({ key, color }) => ({ value: counts[key], color }));
}

export function sessionRingSummary(counts: SessionRingCounts, text: SessionRingText): string {
  const parts = SESSION_RING_STATES.filter(({ key }) => counts[key] > 0).map(({ key }) => `${text[key]} ${counts[key]}`);
  return parts.length > 0 ? parts.join(" · ") : text.empty;
}

const CARD_SESSIONS = 3;
const CARD_TITLE_LENGTH = 40;

function sessionName({ title, cwd, sessionId }: RingSession) {
  const chars = [...(title ?? "")];
  const short = chars.length > CARD_TITLE_LENGTH ? `${chars.slice(0, CARD_TITLE_LENGTH).join("")}…` : chars.join("");
  return [short, sessionProject(cwd)].filter(Boolean).join(" · ") || sessionId.slice(0, 8);
}

export function sessionRingCardLines(sessions: readonly RingSession[], text: SessionRingText): string[] {
  const states = sessions.map((session) => ({ session, state: sessionRingState(session) }));
  const waiting = (["needs", "yourturn"] as const)
    .flatMap((key) => states.filter(({ state }) => state === key).map(({ session }) => text.sessionLine(text[key], sessionName(session))))
    .slice(0, CARD_SESSIONS);
  return [sessionRingSummary(sessionRingCounts(sessions), text), ...waiting];
}
