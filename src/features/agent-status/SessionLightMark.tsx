import { createContext, useContext, useRef } from "react";
import { JellyfishMark, type JellyMood } from "../../components/jellyfish/JellyfishMark";
import type { AgentLightStyle } from "../../lib/settings/types";
import type { SessionLight } from "./sessionLight";
import { useInView } from "./useInView";
import "./SessionLightMark.css";

export const SessionLightStyleContext = createContext<AgentLightStyle>("dot");

const MOODS: Record<SessionLight, JellyMood> = { needs: "waiting", yourTurn: "waiting", working: "running", stale: "stale", failed: "failed", done: "idle" };

export function sessionLightMood(light: SessionLight, quiet: boolean, fresh: boolean, compacting = false): JellyMood {
  if (compacting) return "compacting";
  if (quiet) return "idle";
  if (light === "done" && fresh) return "done";
  return MOODS[light];
}

export function SessionLightMark({ light, quiet, fresh, compacting = false, label }: { light: SessionLight; quiet: boolean; fresh: boolean; compacting?: boolean; label: string }) {
  const style = useContext(SessionLightStyleContext);
  if (style === "dot") return <span className="agent-session__dot" role="img" aria-label={label} title={label} />;
  return <SessionJelly mood={sessionLightMood(light, quiet, fresh, compacting)} label={label} />;
}

function SessionJelly({ mood, label }: { mood: JellyMood; label: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const inView = useInView(box);
  return (
    <span ref={box} className="agent-session__jelly" role="img" aria-label={label} title={label}>
      <JellyfishMark mood={mood} paused={!inView} height={12} />
    </span>
  );
}
