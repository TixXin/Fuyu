import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "../../i18n";
import { AgentProviderIcon } from "./AgentProviderIcon";
import { AGENTS } from "./agents";
import { getAgentHooksState, type AgentHooksState, type AgentSessionSummary, type SessionProvider } from "./api";
import "./EmptyStandby.css";

const SHOWN = 3;
const FIRST: readonly SessionProvider[] = ["claudeCode", "codex"];

function connectedOf(state: AgentHooksState | null): SessionProvider[] {
  if (!state) return [];
  const providers = (Object.keys(AGENTS) as SessionProvider[]).filter((provider) => state[provider] === "current" || state[provider] === "outdated");
  const rank = (provider: SessionProvider) => (FIRST.includes(provider) ? FIRST.indexOf(provider) : FIRST.length);
  return [...providers].sort((a, b) => rank(a) - rank(b));
}

export function EmptyStandby({ sessions, onConnect }: { sessions: readonly AgentSessionSummary[]; onConnect?: () => void }) {
  const t = useTranslation();
  const text = t.agent.empty;
  const [state, setState] = useState<AgentHooksState | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    getAgentHooksState().then(
      (next) => alive && setState(next),
      (error) => console.error("Failed to read agent hooks state for the empty agent page", error),
    );
    return () => {
      alive = false;
    };
  }, []);

  const connected = connectedOf(state);
  const lastSeen = (provider: SessionProvider) => {
    const times = sessions.filter((session) => session.provider === provider).map((session) => session.updatedAt);
    return times.length > 0 ? text.lastSeen(text.ago(Math.floor((now - Math.max(...times)) / 60_000))) : text.neverSeen;
  };
  const rest = connected.length - SHOWN;

  return (
    <div className="agent-empty agent-empty--standby">
      <strong>{text.standbyTitle}</strong>
      <span>{state === null ? " " : connected.length > 0 ? text.standbyHint(connected.length) : text.standbyNone}</span>
      <div className="agent-standby">
        {connected.slice(0, SHOWN).map((provider) => (
          <div key={provider} className="agent-standby__tile">
            <span className="agent-standby__name">
              <AgentProviderIcon provider={provider} size={14} />
              <span>{AGENTS[provider].label}</span>
            </span>
            <span className={`agent-standby__state agent-standby__state--${state?.[provider] ?? "current"}`}>
              {state?.[provider] === "outdated" ? text.hooksOutdated : text.hooksCurrent}
            </span>
            <span className="agent-standby__seen">{lastSeen(provider)}</span>
          </div>
        ))}
        <button className="agent-standby__tile agent-standby__tile--connect" type="button" onClick={onConnect} disabled={!onConnect}>
          <span className="agent-standby__name">
            <Plus size={14} strokeWidth={2.2} aria-hidden="true" />
            <span>{text.connect}</span>
          </span>
          {rest > 0 && <span className="agent-standby__seen">{text.more(rest)}</span>}
        </button>
      </div>
    </div>
  );
}
