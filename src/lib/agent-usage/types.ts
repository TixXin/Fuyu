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
  source?: "hud" | "api" | "magpie" | "codex" | "glm" | "kimi" | "antigravity" | "antigravityCloud" | "cursor";
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

export type HoverProviderId = "workbuddy" | "dsh";

export type WorkbuddyCredits = {
  today: number;
  sevenDay: number;
  total: number;
  totalTokens: number;
  sessions: number;
};

export type DshWallet = {
  currency: string;
  total: string;
  toppedUp: string;
  granted: string;
};

export type HoverUsage = {
  provider: HoverProviderId;
  updatedAt: number | null;
  source: string | null;
  available: boolean | null;
  credits: WorkbuddyCredits | null;
  wallets: DshWallet[];
  error: AgentUsageError | null;
};
