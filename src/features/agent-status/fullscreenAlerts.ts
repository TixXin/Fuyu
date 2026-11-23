import type { AgentSessionSummary } from "./api";

export type FullscreenView = { active: boolean; onIslandMonitor: boolean };
export type FullscreenAlertSettings = { gameAutoTuck: boolean; gameDoNotDisturb: boolean };
export type FullscreenAlert = { tag: string; phase: "waiting" | "failed"; session: AgentSessionSummary };

const ALERTING = new Set(["waiting", "failed"]);
const MAX_TAG = 64;

export function islandHiddenByFullscreen(view: FullscreenView, settings: FullscreenAlertSettings) {
  return view.active && view.onIslandMonitor && settings.gameAutoTuck && !settings.gameDoNotDisturb;
}

export function alertTag(session: AgentSessionSummary) {
  return `${session.remoteHost ? `${session.remoteHost}/` : ""}${session.provider}:${session.sessionId}`.slice(0, MAX_TAG);
}

export function phasesOf(sessions: readonly AgentSessionSummary[]): ReadonlyMap<string, string> {
  return new Map(sessions.map((session) => [alertTag(session), session.phase]));
}

export function freshAlerts(before: ReadonlyMap<string, string>, sessions: readonly AgentSessionSummary[]): FullscreenAlert[] {
  const alerts: FullscreenAlert[] = [];
  for (const session of sessions) {
    const tag = alertTag(session);
    if (ALERTING.has(session.phase) && before.get(tag) !== session.phase) alerts.push({ tag, phase: session.phase as FullscreenAlert["phase"], session });
  }
  return alerts;
}
