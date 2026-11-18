import type { ReactNode } from "react";
import { IslandHoverCard } from "../../components/IslandHoverCard";
import { useTranslation } from "../../i18n";
import type { AgentSessionSummary } from "./api";
import { sessionHoverLines } from "./focusHint";

const HOVER_DELAY_MS = 600;

export { sessionHoverLines };

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
