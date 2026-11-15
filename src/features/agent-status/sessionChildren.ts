import type { AgentSessionSummary } from "./api";
import { sessionLight, type SessionLight } from "./sessionLight.ts";
import { asksUser, sessionKey } from "./unseen.ts";

export type ChildSession = { session: AgentSessionSummary; depth: number };

export type NestedSessions = {
  roots: AgentSessionSummary[];
  children: Map<string, ChildSession[]>;
};

const ALERT_ORDER: SessionLight[] = ["needs", "failed", "yourTurn"];

function nestable(session: AgentSessionSummary) {
  return session.provider === "claudeCode" && !session.remoteHost;
}

export function nestSessions(sessions: AgentSessionSummary[]): NestedSessions {
  const byId = new Map(sessions.filter(nestable).map((session) => [session.sessionId, session]));
  const parentOf = (session: AgentSessionSummary) => {
    if (!nestable(session) || !session.parentId || session.parentId === session.sessionId) return undefined;
    return byId.get(session.parentId);
  };
  const reachesRoot = (session: AgentSessionSummary) => {
    const seen = new Set([session.sessionId]);
    for (let parent = parentOf(session); parent; parent = parentOf(parent)) {
      if (seen.has(parent.sessionId)) return false;
      seen.add(parent.sessionId);
    }
    return true;
  };
  const kids = new Map<string, AgentSessionSummary[]>();
  const roots: AgentSessionSummary[] = [];
  for (const session of sessions) {
    const parent = parentOf(session);
    if (!parent || !reachesRoot(session)) {
      roots.push(session);
      continue;
    }
    kids.set(parent.sessionId, [...(kids.get(parent.sessionId) ?? []), session]);
  }
  const children = new Map<string, ChildSession[]>();
  const walk = (parent: AgentSessionSummary, depth: number, into: ChildSession[]) => {
    for (const child of kids.get(parent.sessionId) ?? []) {
      into.push({ session: child, depth });
      walk(child, depth + 1, into);
    }
  };
  for (const root of roots) {
    const list: ChildSession[] = [];
    walk(root, 1, list);
    if (list.length > 0) children.set(sessionKey(root), list);
  }
  return { roots, children };
}

export function childrenAlert(children: ChildSession[], unseen?: ReadonlySet<string>) {
  const calling = children.filter(({ session }) => asksUser(session) || unseen?.has(sessionKey(session)));
  if (calling.length === 0) return null;
  const lights = calling.map(({ session }) => sessionLight(session));
  const light = ALERT_ORDER.find((candidate) => lights.includes(candidate)) ?? "done";
  return { light, count: calling.length };
}
