import type { ReactNode } from "react";
import { IslandHoverCard, type HoverCardLine } from "../../components/IslandHoverCard";
import { useTranslation } from "../../i18n";
import type { AgentSessionSummary } from "./api";

const HOVER_DELAY_MS = 600;
const PROMPT_CHARS = 240;

function clip(value: string) {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > PROMPT_CHARS ? `${flat.slice(0, PROMPT_CHARS)}…` : flat;
}

export function sessionHoverLines(session: AgentSessionSummary, title: string, text: ReturnType<typeof useTranslation>["agent"]["sessions"]["hover"]): HoverCardLine[] {
  const prompt = session.lastPrompt ? clip(session.lastPrompt) : "";
  const host = session.host?.name ?? session.remoteHost ?? null;
  return [
    { text: title },
    ...(prompt ? [{ text: text.prompt(prompt) }] : []),
    ...(session.cwd ? [{ text: session.remoteHost ? text.remoteFolder(session.remoteHost, session.cwd) : text.folder(session.cwd), muted: true }] : []),
    ...(host ? [{ text: text.host(host), muted: true }] : []),
  ];
}

export function AgentSessionHoverCard({
  session,
  title,
  suppressed,
  children,
}: {
  session: AgentSessionSummary;
  title: string;
  suppressed: boolean;
  children: ReactNode;
}) {
  const t = useTranslation();
  return (
    <IslandHoverCard
      lines={sessionHoverLines(session, title, t.agent.sessions.hover)}
      delayMs={HOVER_DELAY_MS}
      suppressed={suppressed}
      anchorClassName="agent-session__hover"
      cardClassName="agent-session-hover-card"
    >
      {children}
    </IslandHoverCard>
  );
}
