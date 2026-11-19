import type { AgentAlert, AgentAlertKind } from "./alerts.ts";
import type { AgentSessionSummary } from "./api";
import { sessionKey } from "./unseen.ts";
import { MAX_HOVER_HOLD_MS } from "../plugin-kernel/hoverHold.ts";

export const AFTER_HOVER_MS = 2000;

export type NoticeDwell = {
  completedMs: number;
  yourTurnMs: number;
  failedMs: number;
  hoverHold: boolean;
};

export type NoticeStay = "handled" | "looked" | number;

export type AlertedNotice = { key: string; kind: AgentAlertKind; session: AgentSessionSummary };

export type NoticeEntry = AlertedNotice & {
  arrived: number;
  stay: NoticeStay;
  deadline: number;
  pausedAt: number | null;
  hovered: boolean;
  wasUnseen: boolean;
};

export function noticeUrgency(kind: AgentAlertKind, session: AgentSessionSummary) {
  if (session.phase === "waiting") return 0;
  if (kind === "failed") return 1;
  if (kind === "waiting") return 2;
  if (kind === "completed") return 3;
  return 4;
}

export function noticeStay(kind: AgentAlertKind, session: AgentSessionSummary, dwell: NoticeDwell): NoticeStay {
  if (session.phase === "waiting") return "handled";
  if (kind === "failed") return dwell.failedMs > 0 ? dwell.failedMs : "looked";
  if (kind === "waiting") return dwell.yourTurnMs > 0 ? dwell.yourTurnMs : "looked";
  return dwell.completedMs;
}

export function sortNotices<T extends NoticeEntry>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => noticeUrgency(a.kind, a.session) - noticeUrgency(b.kind, b.session) || b.arrived - a.arrived);
}

export function addNotices(entries: readonly NoticeEntry[], alerts: readonly AgentAlert[], dwell: NoticeDwell, now: number): NoticeEntry[] {
  const added = alerts.map((alert, index): NoticeEntry => {
    const stay = noticeStay(alert.kind, alert.session, dwell);
    return {
      key: sessionKey(alert.session),
      kind: alert.kind,
      session: alert.session,
      arrived: now + index / 1000,
      stay,
      deadline: typeof stay === "number" ? now + stay : Infinity,
      pausedAt: null,
      hovered: false,
      wasUnseen: false,
    };
  });
  const keys = new Set(added.map((entry) => entry.key));
  return [...entries.filter((entry) => !keys.has(entry.key)), ...added];
}

function effectiveDeadline(entry: NoticeEntry, now: number) {
  return entry.pausedAt === null ? entry.deadline : entry.deadline + Math.min(now - entry.pausedAt, MAX_HOVER_HOLD_MS);
}

export function hoverNotices(entries: readonly NoticeEntry[], hovered: boolean, now: number, dwell: NoticeDwell): NoticeEntry[] {
  if (hovered) {
    const top = sortNotices(entries)[0]?.key;
    return entries.map((entry) => ({
      ...entry,
      hovered: entry.hovered || entry.key === top,
      pausedAt: dwell.hoverHold ? entry.pausedAt ?? now : null,
    }));
  }
  return entries.map((entry) => {
    let deadline = entry.deadline;
    if (entry.pausedAt !== null) deadline = Math.max(effectiveDeadline(entry, now), now + AFTER_HOVER_MS);
    if (entry.stay === "looked" && entry.hovered && deadline === Infinity) deadline = now + AFTER_HOVER_MS;
    return { ...entry, deadline, pausedAt: null };
  });
}

export function pruneNotices(
  entries: readonly NoticeEntry[],
  sessions: readonly AgentSessionSummary[],
  isUnseen: (session: AgentSessionSummary) => boolean,
  now: number,
): NoticeEntry[] {
  const current = new Map(sessions.map((session) => [sessionKey(session), session]));
  return entries.flatMap((entry) => {
    const live = current.get(entry.key);
    if (entry.stay === "handled") return live?.phase === "waiting" ? [{ ...entry, session: live }] : [];
    let wasUnseen = entry.wasUnseen;
    if (entry.stay === "looked" && live) {
      const unseen = isUnseen(live);
      if (wasUnseen && !unseen) return [];
      wasUnseen = wasUnseen || unseen;
    }
    if (now >= effectiveDeadline(entry, now)) return [];
    return [{ ...entry, session: live ?? entry.session, wasUnseen }];
  });
}

export function sameNotices(a: readonly NoticeEntry[], b: readonly NoticeEntry[]) {
  return a.length === b.length && a.every((entry, index) => {
    const other = b[index];
    return entry.key === other.key && entry.session === other.session && entry.deadline === other.deadline
      && entry.pausedAt === other.pausedAt && entry.hovered === other.hovered && entry.wasUnseen === other.wasUnseen;
  });
}
