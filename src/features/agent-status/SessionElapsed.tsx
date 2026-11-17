import { useEffect, useState } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { useTranslation } from "../../i18n";
import type { AgentSessionSummary } from "./api";
import { durationParts, isActivePhase, turnElapsedMs } from "./sessionList";

export function SessionElapsed({ session }: { session: AgentSessionSummary }) {
  const t = useTranslation();
  const active = isActivePhase(session.phase);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    return visibilityInterval(() => setNow(Date.now()), 1000);
  }, [active]);

  const elapsed = turnElapsedMs(session, now);
  if (elapsed === null) return null;
  const duration = t.agent.sessions.duration(durationParts(elapsed));
  return (
    <span className="agent-session__elapsed">
      {active ? t.agent.sessions.elapsedRunning(duration) : t.agent.sessions.elapsedDone(duration)}
    </span>
  );
}
