import type { Translations } from "../../../i18n";
import type { AgentSessionSummary } from "../api";

export function demoAgentSessions(text: Translations["onboarding"]["demo"], startedAt: number): AgentSessionSummary[] {
  return [{
    provider: "claudeCode",
    sessionId: "fuyu-onboarding-demo",
    cwd: null,
    title: text.agentTitle,
    model: "Opus 5.5",
    effort: null,
    phase: "running",
    lastMessage: null,
    updatedAt: startedAt,
    host: null,
    turnStartedAt: startedAt,
    lastPrompt: text.agentPrompt,
  }];
}
