import type { CcConnectChat } from "./service.ts";

export const CC_CONNECT_AGENT_LABELS: Record<string, string> = {
  claudecode: "Claude Code",
  codex: "Codex",
  copilot: "GitHub Copilot CLI",
  opencode: "opencode",
  qoder: "Qoder CLI",
  kimi: "Kimi Code",
  antigravity: "Antigravity",
};

export function chatLabel(chat: CcConnectChat, platforms: Record<string, string>) {
  const platform = platforms[chat.platform] ?? chat.platform;
  return chat.userName ? `${platform} · ${chat.userName}` : platform;
}
