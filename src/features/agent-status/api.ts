import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { AgentEffortLabels } from "./effortLabels";

export type AgentProvider = "codex" | "claudeCode";
export type SessionProvider = AgentProvider | "workbuddy";
export type AgentTaskPhase = "idle" | "running" | "waiting" | "completed" | "failed" | "stale";

export type AgentTaskStatus = {
  phase: AgentTaskPhase;
  taskId?: string;
  updatedAt: number;
  title?: string;
};

export type ExternalAgentStatus = AgentTaskStatus & {
  id: string;
  name: string;
  host?: string;
  agent?: AgentProvider;
  cwd?: string;
};

export type AgentStatusSnapshot = Record<AgentProvider, AgentTaskStatus> & {
  updatedAt: number;
  statusPath: string;
  others?: ExternalAgentStatus[];
};

export type AgentHooksInstallResult = {
  scriptsDir: string;
  statusPath: string;
  codexConfigPath: string;
  claudeConfigPath: string;
  installedAt: number;
  remotes: RemoteResult[];
};

export type RemoteResult = { host: string; error: string | null };

export type HookInstallState = "notInstalled" | "outdated" | "current";

export type AgentHooksState = Record<AgentProvider, HookInstallState> & {
  scriptsOutdated: boolean;
};

export type AgentSessionSummary = {
  provider: SessionProvider;
  sessionId: string;
  cwd: string | null;
  title: string | null;
  titleSource?: "rename" | "agent" | "prompt" | "folder" | null;
  model: string | null;
  effort: string | null;
  phase: Exclude<AgentTaskPhase, "idle">;
  lastMessage: string | null;
  updatedAt: number;
  host: SessionHost | null;
  turnStartedAt: number | null;
  lastPrompt?: string | null;
  currentTool?: AgentToolCall | null;
  permissionMode?: AgentPermissionMode | null;
  subagents?: number;
  replyMarker?: ReplyMarker | null;
  replyAsks?: boolean;
  backgroundTasks?: number;
  remoteHost?: string;
  compacting?: boolean;
  contextTokens?: number | null;
  todos?: AgentTodoProgress | null;
  closed?: boolean;
};

export type AgentTodoProgress = { done: number; total: number; current: string | null };

export type ReplyMarker = "yourTurn" | "background" | "done";

export type ReplyMarkerState = {
  installed: boolean;
  outdated: boolean;
  path: string;
  content: string;
  remotes: RemoteResult[];
};

export function getReplyMarkerState() {
  return invoke<ReplyMarkerState>("get_reply_marker_state");
}

export function setReplyMarker(enabled: boolean) {
  return invoke<ReplyMarkerState>("set_reply_marker", { enabled });
}

export type AgentPermissionMode = "default" | "auto" | "bypass" | "acceptEdits" | "plan";

export type AgentToolCall = {
  name: string;
  detail: string | null;
};

export type SessionHost = {
  name: string;
  exe: string | null;
  kind: "terminal" | "editor" | "app" | "remote";
};

export function getAgentHostIcon(path: string) {
  return invoke<string | null>("get_agent_host_icon", { path });
}

export function listAgentSessions(windowHours?: number) {
  return invoke<AgentSessionSummary[]>("list_agent_sessions", { windowHours });
}

export type RemoteHostStatus = {
  host: string;
  fetchedAt: number | null;
  error: string | null;
  fetching: boolean;
  sessions?: number;
  approvalError?: string | null;
};

export type CustomRemoteHost = {
  name: string;
  user?: string | null;
  host: string;
  port?: number | null;
};

export function getAgentCustomHosts() {
  return invoke<CustomRemoteHost[]>("get_agent_custom_hosts");
}

export function addAgentRemoteHost(host: CustomRemoteHost) {
  return invoke<CustomRemoteHost[]>("add_agent_remote_host", { host });
}

export function removeAgentRemoteHost(name: string) {
  return invoke<CustomRemoteHost[]>("remove_agent_remote_host", { name });
}

export function refreshAgentRemoteHosts() {
  return invoke<void>("refresh_agent_remote_hosts");
}

export function listSshHosts() {
  return invoke<string[]>("list_ssh_hosts");
}

export function getAgentRemoteHosts() {
  return invoke<RemoteHostStatus[]>("get_agent_remote_hosts");
}

export function setAgentRemoteHosts(hosts: string[]) {
  return invoke<string[]>("set_agent_remote_hosts", { hosts });
}

export function focusAgentWindow(provider: SessionProvider, cwd: string | null, title: string | null, sessionId: string) {
  return invoke<boolean>("focus_agent_window", { provider, cwd, title, sessionId });
}

export type EditorExtensionState = {
  app: string;
  name: string;
  installed: boolean;
  canInstall: boolean;
};

export function getEditorExtensionStates() {
  return invoke<EditorExtensionState[]>("get_editor_extension_states");
}

export function installEditorExtension(app: string) {
  return invoke<void>("install_editor_extension", { app });
}

const EDITOR_EXTENSION_MISSING_EVENT = "agent-editor-extension-missing";

export type EditorExtensionMissing = { app: string; name: string };

export function listenEditorExtensionMissing(onMissing: (editor: EditorExtensionMissing) => void) {
  return listen<EditorExtensionMissing>(EDITOR_EXTENSION_MISSING_EVENT, (event) => onMissing(event.payload));
}

export function agentSessionsInFront(sessions: Pick<AgentSessionSummary, "provider" | "sessionId">[]) {
  return invoke<string[]>("agent_sessions_in_front", {
    sessions: sessions.map(({ provider, sessionId }) => ({ provider, sessionId })),
  });
}

export type UsageWindow = {
  name: string;
  used: number;
  resetsAt: number | null;
};

export type AgentUsage = {
  updatedAt: number | null;
  fiveHour: UsageWindow | null;
  sevenDay: UsageWindow | null;
  models: UsageWindow[];
  plan: string | null;
  source?: "hud" | "api" | "magpie" | "codex" | "glm" | "kimi";
  error?: AgentUsageError | null;
};

export type AgentUsageErrorKind =
  | "noCredentials"
  | "tokenExpired"
  | "loginRequired"
  | "forbidden"
  | "rateLimited"
  | "noProxy"
  | "network"
  | "http"
  | "invalidResponse";

export type AgentUsageError = { kind: AgentUsageErrorKind; message: string };

export function getAgentUsage() {
  return invoke<AgentUsage | null>("get_agent_usage");
}

export function getCodexUsage() {
  return invoke<AgentUsage | null>("get_codex_usage");
}

export type PlanProvider = "glm" | "kimi";

export function getPlanUsage(provider: PlanProvider, refresh = false) {
  return invoke<AgentUsage>("get_plan_usage", { provider, refresh });
}

export function setPlanKey(provider: PlanProvider, key: string) {
  return invoke<boolean>("set_plan_key", { provider, key });
}

export function hasPlanKey(provider: PlanProvider) {
  return invoke<boolean>("has_plan_key", { provider });
}

export function getAgentHooksState() {
  return invoke<AgentHooksState>("get_agent_hooks_state");
}

export function getAgentStatus() {
  return invoke<AgentStatusSnapshot>("get_agent_status");
}

export function clearAgentProviderStatus(provider: string) {
  return invoke<AgentStatusSnapshot>("clear_agent_status", { provider });
}

export function installAgentStatusHooks() {
  return invoke<AgentHooksInstallResult>("install_agent_status_hooks");
}

export function listAgentEffortLabels() {
  return invoke<AgentEffortLabels>("list_agent_effort_labels");
}
