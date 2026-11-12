import type { AgentSessionSummary, ReplyMarker } from "./api";

export function replyEnding(session: Pick<AgentSessionSummary, "replyMarker" | "replyAsks" | "backgroundTasks">): ReplyMarker | null {
  if (session.replyMarker) return session.replyMarker;
  if (session.replyAsks) return "yourTurn";
  return session.backgroundTasks ? "background" : null;
}

export function rememberedPhase(session: Pick<AgentSessionSummary, "phase" | "replyMarker" | "replyAsks" | "backgroundTasks">): AgentSessionSummary["phase"] {
  return session.phase === "completed" && replyEnding(session) === "background" ? "running" : session.phase;
}

export type SessionLight = "needs" | "yourTurn" | "working" | "stale" | "done" | "failed";

type LightFields = Pick<AgentSessionSummary, "phase" | "replyMarker" | "replyAsks" | "backgroundTasks">;

export function sessionLight(session: LightFields): SessionLight {
  switch (session.phase) {
    case "waiting":
      return "needs";
    case "running":
      return "working";
    case "stale":
      return "stale";
    case "failed":
      return "failed";
    default:
      switch (replyEnding(session)) {
        case "yourTurn":
          return "yourTurn";
        case "background":
          return "working";
        default:
          return "done";
      }
  }
}
