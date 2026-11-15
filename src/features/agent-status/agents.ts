type AgentInfo = { label: string; statusLight: boolean; remote: boolean };

export const AGENTS = {
  codex: { label: "Codex", statusLight: true, remote: true },
  claudeCode: { label: "Claude Code", statusLight: true, remote: true },
  workbuddy: { label: "WorkBuddy", statusLight: true, remote: false },
  antigravity: { label: "Antigravity", statusLight: true, remote: false },
  dsh: { label: "DeepSeek Harness", statusLight: true, remote: true },
  opencode: { label: "opencode", statusLight: false, remote: false },
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
