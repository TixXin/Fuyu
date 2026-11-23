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

export function SessionJelly({ mood, label, className = "agent-session__jelly", height = 12 }: { mood: JellyMood; label?: string; className?: string; height?: number }) {
  const box = useRef<HTMLSpanElement>(null);
  const inView = useInView(box);
  const named = label ? { role: "img", "aria-label": label, title: label } : { "aria-hidden": true };
  return (
    <span ref={box} className={className} {...named}>
      <JellyfishMark mood={mood} paused={!inView} height={height} />
    </span>
  );
}
