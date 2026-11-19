import type { HoverCardLine } from "../../components/IslandHoverCard";
import type { AgentText } from "../../i18n/sections/agent";
import type { AgentSessionSummary, SessionProvider } from "./api";

const PROMPT_CHARS = 240;

const WINDOW_ONLY_PROVIDERS: ReadonlySet<SessionProvider> = new Set([
  "dsh",
  "trae",
  "traeCn",
]);

function clip(value: string) {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > PROMPT_CHARS ? `${flat.slice(0, PROMPT_CHARS)}…` : flat;
}

export function focusesWindowOnly(session: Pick<AgentSessionSummary, "provider" | "host" | "remoteHost">): boolean {
  if (session.remoteHost || session.provider === "workbuddy") return false;
  if (WINDOW_ONLY_PROVIDERS.has(session.provider)) return true;
  if (session.host) return session.host.kind === "app";
  return session.provider === "antigravity";
}

export function sessionHoverLines(
  session: AgentSessionSummary,
  title: string,
  text: AgentText["sessions"]["hover"],
): HoverCardLine[] {
  const prompt = session.lastPrompt ? clip(session.lastPrompt) : "";
  const host = session.host?.name ?? session.remoteHost ?? null;
  return [
    { text: title },
    ...(prompt ? [{ text: text.prompt(prompt) }] : []),
    ...(session.cwd ? [{ text: session.remoteHost ? text.remoteFolder(session.remoteHost, session.cwd) : text.folder(session.cwd), muted: true }] : []),
    ...(host ? [{ text: text.host(host), muted: true }] : []),
    ...(focusesWindowOnly(session) ? [{ text: text.windowOnly, muted: true }] : []),
  ];
}
