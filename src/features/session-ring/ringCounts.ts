import type { AgentSessionSummary } from "../agent-status/api";
import { sessionProject } from "../agent-status/sessionList.ts";
import { sessionKey } from "../agent-status/unseen.ts";
import { sessionLight } from "../agent-status/sessionLight.ts";
import type { SessionRingText } from "../../i18n/sections/sessionRing";

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

export function sessionRingState(session: AgentSessionSummary, unseen: ReadonlySet<string>): SessionRingState {
  const light = sessionLight(session);
  if (!unseen.has(sessionKey(session)) && (light === "needs" || light === "yourTurn" || light === "failed")) return "done";
  switch (light) {
    case "needs":
    case "failed":
      return "needs";
    case "yourTurn":
      return "yourturn";
    case "working":
      return "working";
    case "stale":
      return "stale";
    case "done":
      return "done";
  }
}

export function sessionRingCounts(sessions: readonly AgentSessionSummary[], unseen: ReadonlySet<string>): SessionRingCounts {
  const counts: SessionRingCounts = { needs: 0, yourturn: 0, working: 0, stale: 0, done: 0, total: 0 };
  for (const session of sessions) {
    counts[sessionRingState(session, unseen)] += 1;
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

function sessionName({ title, cwd, sessionId }: AgentSessionSummary) {
  const chars = [...(title ?? "")];
  const short = chars.length > CARD_TITLE_LENGTH ? `${chars.slice(0, CARD_TITLE_LENGTH).join("")}…` : chars.join("");
  return [short, sessionProject(cwd)].filter(Boolean).join(" · ") || sessionId.slice(0, 8);
}

export function sessionRingCardLines(
  sessions: readonly AgentSessionSummary[],
  unseen: ReadonlySet<string>,
  text: SessionRingText,
): string[] {
  const states = sessions.map((session) => ({ session, state: sessionRingState(session, unseen) }));
  const waiting = (["needs", "yourturn"] as const)
    .flatMap((key) => states.filter(({ state }) => state === key).map(({ session }) => text.sessionLine(text[key], sessionName(session))))
    .slice(0, CARD_SESSIONS);
  return [sessionRingSummary(sessionRingCounts(sessions, unseen), text), ...waiting];
}
