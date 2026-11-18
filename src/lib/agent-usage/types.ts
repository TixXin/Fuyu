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
  source?: "hud" | "api" | "magpie" | "codex" | "glm" | "kimi" | "antigravity" | "antigravityCloud";
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
  | "invalidResponse"
  | "endpointChanged"
  | "noSessions"
  | "customEndpoint";

export type AgentUsageError = { kind: AgentUsageErrorKind; message: string };
