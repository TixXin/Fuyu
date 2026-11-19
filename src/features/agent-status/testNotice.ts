import { alertKind, type AgentAlert } from "./alerts.ts";
import type { AgentSessionSummary } from "./api";
import type { AgentApprovalRequest } from "./approvals/api";
import { addNotices, type NoticeDwell, type NoticeEntry } from "./noticeDwell.ts";
import { PREVIEW_EVENTS, type PreviewEvent } from "./reminder-settings/previewEvents.ts";
import type { PreviewSamples } from "./reminder-settings/previewSamples.ts";

export const TEST_SESSION_PREFIX = "fuyu-test-";
export const TEST_HANDLED_MS = 30_000;

export const TEST_NOTICE_OUTCOMES = ["shown", "shownCard", "busy", "expanded", "muted"] as const;

export type TestNoticeOutcome = (typeof TEST_NOTICE_OUTCOMES)[number];

export type TestNoticeRequest = {
  id: number;
  event: PreviewEvent;
  sessions: AgentSessionSummary[];
  request: AgentApprovalRequest | null;
};

export type TestNoticeResult = { id: number; outcome: TestNoticeOutcome };

export type StampedTestNotice = { alerts: AgentAlert[]; request: AgentApprovalRequest | null };

type Fields = Record<string, unknown>;

const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);

const isSession = (value: unknown): value is AgentSessionSummary =>
  isFields(value) && typeof value.provider === "string" && typeof value.sessionId === "string" && typeof value.phase === "string";

const isRequest = (value: unknown): value is AgentApprovalRequest =>
  isFields(value) && (value.kind === "permission" || value.kind === "question") && typeof value.toolName === "string";

export function isTestSession(session: Pick<AgentSessionSummary, "sessionId">) {
  return session.sessionId.startsWith(TEST_SESSION_PREFIX);
}

export function testNoticeRequest(event: PreviewEvent, samples: PreviewSamples, id: number): TestNoticeRequest {
  if (event === "stack") return { id, event, sessions: [...samples.stack], request: null };
  const request = event === "approval" || event === "question" ? samples.requests[event] : null;
  return { id, event, sessions: [samples.sessions[event]], request };
}

export function readTestNoticeRequest(payload: unknown): TestNoticeRequest | null {
  if (!isFields(payload) || typeof payload.id !== "number") return null;
  const event = PREVIEW_EVENTS.find((name) => name === payload.event);
  const sessions = Array.isArray(payload.sessions) ? payload.sessions.filter(isSession) : [];
  if (!event || sessions.length === 0) return null;
  return { id: payload.id, event, sessions, request: isRequest(payload.request) ? payload.request : null };
}

export function readTestNoticeResult(payload: unknown): TestNoticeResult | null {
  if (!isFields(payload) || typeof payload.id !== "number") return null;
  const outcome = TEST_NOTICE_OUTCOMES.find((name) => name === payload.outcome);
  return outcome ? { id: payload.id, outcome } : null;
}

function testAlertKind(session: AgentSessionSummary) {
  return alertKind(session.phase === "running" ? undefined : "running", session.phase, session.replyMarker ?? null) ?? "completed";
}

export function stampTestNotice(test: TestNoticeRequest, now: number): StampedTestNotice {
  const sessions = test.sessions.map((session, index) => ({ ...session, sessionId: `${TEST_SESSION_PREFIX}${test.id}-${index}`, updatedAt: now }));
  const alerts = sessions.map((session): AgentAlert => ({ kind: testAlertKind(session), session }));
  const first = sessions[0];
  if (!test.request || !first) return { alerts, request: null };
  return { alerts, request: { ...test.request, id: -Math.abs(test.id) - 1, agent: first.provider, sessionId: first.sessionId, receivedAt: now } };
}

export function testNotices(alerts: readonly AgentAlert[], dwell: NoticeDwell, now: number): NoticeEntry[] {
  return addNotices([], alerts, dwell, now).map((entry) => (entry.stay === "handled" ? { ...entry, stay: TEST_HANDLED_MS, deadline: now + TEST_HANDLED_MS } : entry));
}

export function testNoticeBlock(shown: readonly Pick<NoticeEntry, "session">[], canAlert: boolean, isCollapsed: boolean): Exclude<TestNoticeOutcome, "shown" | "shownCard"> | null {
  if (!canAlert) return "muted";
  if (shown.some((entry) => !isTestSession(entry.session))) return "busy";
  return !isCollapsed && shown.length === 0 ? "expanded" : null;
}
