import type { AgentSessionSummary } from "../api";
import { replyEnding } from "../sessionLight.ts";

export const AGENT_SOUND_EVENTS = ["start", "complete", "error", "approval", "question", "ack", "compact", "idle", "quotaLow", "quotaReset"] as const;

export type AgentSoundEvent = (typeof AGENT_SOUND_EVENTS)[number];

export function isAgentSoundEvent(value: unknown): value is AgentSoundEvent {
  return typeof value === "string" && (AGENT_SOUND_EVENTS as readonly string[]).includes(value);
}

type Phase = AgentSessionSummary["phase"];

const QUESTION_TOOL = "AskUserQuestion";

export function soundFor(
  before: Phase | undefined,
  after: Phase,
  session: Pick<AgentSessionSummary, "currentTool" | "replyMarker" | "replyAsks" | "backgroundTasks">,
): AgentSoundEvent | null {
  if (after === "waiting" && before !== "waiting") {
    return session.currentTool?.name === QUESTION_TOOL ? "question" : "approval";
  }
  if (before === undefined) return after === "running" ? "start" : null;
  if (after === "failed" && before !== "failed") return "error";
  if (after === "completed" && (before === "running" || before === "waiting" || before === "stale")) {
    const ending = replyEnding(session);
    return ending === "yourTurn" ? "question" : ending === "background" ? null : "complete";
  }
  if (after === "running" && (before === "completed" || before === "failed")) return "ack";
  return null;
}

export function reminderSound(session: Pick<AgentSessionSummary, "currentTool" | "replyMarker" | "phase">): AgentSoundEvent {
  return session.currentTool?.name === QUESTION_TOOL || (session.phase === "completed" && session.replyMarker === "yourTurn") ? "question" : "approval";
}
