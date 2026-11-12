import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AgentProvider } from "../api";

export const AGENT_APPROVAL_REQUESTED_EVENT = "agent-approval-requested";
export const AGENT_APPROVAL_CLOSED_EVENT = "agent-approval-closed";

export type AgentApprovalRequest = {
  id: number;
  kind: "permission" | "question";
  agent: AgentProvider;
  sessionId: string;
  cwd: string | null;
  toolName: string;
  toolInput: unknown;
  permissionSuggestions: unknown[] | null;
  receivedAt: number;
  remoteHost?: string;
};

export type AgentApprovalCloseReason = "decided" | "timeout" | "disconnected" | "handedBack" | "shutdown" | "answeredElsewhere";

export type AgentApprovalClosed = { id: number; reason: AgentApprovalCloseReason };

export type AgentApprovalDecision = "allow" | "deny" | "allowAlways" | "terminal" | "answer";

export type AgentQuestionAnswers = Record<string, string>;

export function setAgentApprovalEnabled(enabled: boolean) {
  return invoke<void>("set_agent_approval_enabled", { enabled });
}

export function decideAgentApproval(id: number, decision: AgentApprovalDecision, message?: string, answers?: AgentQuestionAnswers) {
  return invoke<void>("agent_approval_decide", { id, decision, message: message ?? null, answers: answers ?? null });
}

export function getPendingAgentApprovals() {
  return invoke<AgentApprovalRequest[]>("agent_approval_pending");
}

export function listenAgentApprovalRequested(onRequest: (request: AgentApprovalRequest) => void): Promise<UnlistenFn> {
  return listen<AgentApprovalRequest>(AGENT_APPROVAL_REQUESTED_EVENT, (event) => onRequest(event.payload));
}

export function listenAgentApprovalClosed(onClosed: (closed: AgentApprovalClosed) => void): Promise<UnlistenFn> {
  return listen<AgentApprovalClosed>(AGENT_APPROVAL_CLOSED_EVENT, (event) => onClosed(event.payload));
}

export const APPROVAL_HOTKEY_EVENT = "agent-approval-hotkey";

export const APPROVAL_HOTKEYS: { action: AgentApprovalDecision; shortcut: string }[] = [
  { action: "allow", shortcut: "Ctrl+Alt+Y" },
  { action: "deny", shortcut: "Ctrl+Alt+N" },
  { action: "terminal", shortcut: "Ctrl+Alt+T" },
];

export function setAgentApprovalHotkeys(hotkeys: typeof APPROVAL_HOTKEYS) {
  return invoke<void>("set_agent_approval_hotkeys", { hotkeys });
}

export function listenAgentApprovalHotkey(onPress: (action: AgentApprovalDecision) => void) {
  return listen<{ action: AgentApprovalDecision }>(APPROVAL_HOTKEY_EVENT, (event) => onPress(event.payload.action));
}
