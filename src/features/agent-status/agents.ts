type AgentInfo = { label: string; statusLight: boolean; remote: boolean };

export const AGENTS = {
  codex: { label: "Codex", statusLight: true, remote: true },
  claudeCode: { label: "Claude Code", statusLight: true, remote: true },
  workbuddy: { label: "WorkBuddy", statusLight: true, remote: false },
  antigravity: { label: "Antigravity", statusLight: true, remote: true },
  dsh: { label: "DeepSeek Harness", statusLight: true, remote: true },
  opencode: { label: "opencode", statusLight: false, remote: false },
  qoder: { label: "Qoder", statusLight: true, remote: false },
  codebuddy: { label: "CodeBuddy", statusLight: true, remote: false },
  qwen: { label: "Qwen Code", statusLight: true, remote: false },
  trae: { label: "TRAE", statusLight: true, remote: false },
  traeCn: { label: "TRAE CN", statusLight: true, remote: false },
  zcode: { label: "ZCode", statusLight: true, remote: false },
  kimiCode: { label: "Kimi Code", statusLight: true, remote: false },
  mimo: { label: "MiMo Code", statusLight: false, remote: false },
} as const satisfies Record<string, AgentInfo>;

export type SessionProvider = keyof typeof AGENTS;

type Having<Flag extends "statusLight" | "remote"> = {
  [Provider in SessionProvider]: (typeof AGENTS)[Provider][Flag] extends true ? Provider : never;
}[SessionProvider];

export type AgentProvider = Having<"statusLight">;
export type RemoteProvider = Having<"remote">;

export const SESSION_PROVIDERS = Object.keys(AGENTS) as SessionProvider[];

export const AGENT_PROVIDERS = SESSION_PROVIDERS.filter(
  (provider): provider is AgentProvider => AGENTS[provider].statusLight,
);

export const REMOTE_PROVIDERS = SESSION_PROVIDERS.filter(
  (provider): provider is RemoteProvider => AGENTS[provider].remote,
);

export function isRemoteProvider(provider: string | undefined): provider is RemoteProvider {
  return REMOTE_PROVIDERS.some((known) => known === provider);
}
