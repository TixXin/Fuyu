import type { AgentAlert } from "../alerts";
import type { AgentSessionSummary } from "../api";
import type { AgentPushDetail } from "./api";

/** Room for the body: a phone screen, or more on Discord, which renders long text and splits it itself. */
export const MAX_BODY_CHARS = 600;
export const DISCORD_MAX_BODY_CHARS = 3500;

/** The cc-connect agent type (`[projects.agent] type`) that can resume each provider's sessions. */
const TAKEOVER_AGENTS: Record<AgentSessionSummary["provider"], string> = { claudeCode: "claudecode", codex: "codex" };

/**
 * The commands that take a session over in cc-connect: `/cd` to its folder, then `/switch` to it.
 * Only through a project whose agent is the session's own (`agent`; a Claude Code project cannot
 * resume a Codex session), and only by the cc-connect of the computer the session runs on, which
 * the caller sees to. However the session was started (a terminal, Happy) does not matter.
 */
export function takeoverCommands(session: AgentSessionSummary, agent: string | null): string[] {
  if (!session.cwd || agent !== TAKEOVER_AGENTS[session.provider]) return [];
  return [`/cd ${session.cwd}`, `/switch ${session.sessionId.slice(0, 8)}`];
}

/** What the push says beyond its heading: the question, plan or reply; for an approval, the tool. */
export function pushBody({ kind, session }: AgentAlert, detail: AgentPushDetail): string {
  if (kind !== "failed" && detail.wait) return detail.wait.text;
  const tool = session.currentTool;
  if (kind === "waiting" && tool) return tool.detail ? `${tool.name}: ${tool.detail}` : tool.name;
  return session.lastMessage ?? "";
}

/**
 * One cc-connect message: the heading, the body cut to fit, and the takeover commands, each on its
 * own so it can be copied alone (a `/cd` sent with the next line would take it as part of the
 * path). Discord gets inline code, which its Android app copies on a tap; elsewhere code blocks.
 */
export function ccConnectText(heading: string, body: string, commands: string[], takeoverHint: string, platform: string) {
  const discord = platform === "discord";
  const max = discord ? DISCORD_MAX_BODY_CHARS : MAX_BODY_CHARS;
  let text = body.length > max ? `${body.slice(0, max)}…` : body;
  // A cut through a code block would swallow the commands after it.
  if ((text.match(/```/g)?.length ?? 0) % 2 === 1) text += "\n```";
  const lines = commands.map((command) => (discord ? `\`${command}\`` : `\`\`\`bash\n${command}\n\`\`\``));
  return [`🔔 ${heading}`, text.trim(), commands.length > 0 ? `${takeoverHint}\n${lines.join("\n")}` : ""].filter(Boolean).join("\n");
}
