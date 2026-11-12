import type { AgentSessionSummary, ExternalAgentStatus } from "./api";

export function isRemoteSessionReport(report: ExternalAgentStatus) {
  return Boolean(report.host) && (report.agent === "claudeCode" || report.agent === "codex");
}

export function remoteSessions(others: ExternalAgentStatus[] | undefined): AgentSessionSummary[] {
  return (others ?? []).flatMap((report) => {
    if (!isRemoteSessionReport(report) || report.phase === "idle" || !report.agent || !report.host) return [];
    return [{
      provider: report.agent,
      sessionId: report.id,
      cwd: report.cwd ?? null,
      title: report.title ?? null,
      model: null,
      effort: null,
      phase: report.phase,
      lastMessage: null,
      updatedAt: report.updatedAt,
      host: { name: report.host, exe: null, kind: "remote" },
      turnStartedAt: null,
      remoteHost: report.host,
    }];
  });
}

export function withRemoteSessions(local: AgentSessionSummary[], remote: AgentSessionSummary[]) {
  if (remote.length === 0) return local;
  const active = (session: AgentSessionSummary) => session.phase === "running" || session.phase === "waiting";
  return [...local, ...remote].sort((a, b) => Number(active(b)) - Number(active(a)) || b.updatedAt - a.updatedAt);
}
