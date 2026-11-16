import type { Translations } from "../../../i18n";
import type { AgentApprovalDecision } from "./api";

export function approvalLabel(t: Translations, action: AgentApprovalDecision) {
  const approvalLabels: Partial<Record<AgentApprovalDecision, string>> = { allow: t.agent.approval.allow, deny: t.agent.approval.deny, terminal: t.agent.approval.terminal };
  return approvalLabels[action] ?? action;
}
