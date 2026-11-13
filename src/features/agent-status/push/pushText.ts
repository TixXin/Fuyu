import type { AgentAlert } from "../alerts";
import type { AgentSessionSummary } from "../api";
import type { AgentPushDetail } from "./api";

export const MAX_BODY_CHARS = 600;
export const DISCORD_MAX_BODY_CHARS = 3500;

const TAKEOVER_AGENTS: Partial<Record<AgentSessionSummary["provider"], string>> = { claudeCode: "claudecode", codex: "codex" };

export function takeoverCommands(session: AgentSessionSummary, agent: string | null): string[] {
  if (!session.cwd || agent !== TAKEOVER_AGENTS[session.provider]) return [];
  return [`/cd ${session.cwd}`, `/switch ${session.sessionId.slice(0, 8)}`];
}

export function pushBody({ kind, session }: AgentAlert, detail: AgentPushDetail): string {
  if (kind !== "failed" && detail.wait) return detail.wait.text;
  const tool = session.currentTool;
  if (kind === "waiting" && tool) return tool.detail ? `${tool.name}: ${tool.detail}` : tool.name;
  return session.lastMessage ?? "";
}

export function ccConnectText(heading: string, body: string, commands: string[], takeoverHint: string, platform: string) {
  const discord = platform === "discord";
  const max = discord ? DISCORD_MAX_BODY_CHARS : MAX_BODY_CHARS;
  let text = body.length > max ? `${body.slice(0, max)}…` : body;
  if ((text.match(/```/g)?.length ?? 0) % 2 === 1) text += "\n```";
  const lines = commands.map((command) => (discord ? `\`${command}\`` : `\`\`\`bash\n${command}\n\`\`\``));
  return [`🔔 ${heading}`, text.trim(), commands.length > 0 ? `${takeoverHint}\n${lines.join("\n")}` : ""].filter(Boolean).join("\n");
}
