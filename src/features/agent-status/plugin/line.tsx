import type { ReactNode } from "react";
import { Bot } from "lucide-react";
import { defineSlot } from "../../plugin-kernel/slots";
import { AgentProviderIcon } from "../AgentProviderIcon";
import { agentLine } from "./islandState";
import { OWNER } from "./owner.ts";

type LineContext = {
  showTitle: boolean;
  agentIcon: ReactNode | null;
};

const lineSlot = defineSlot<LineContext>("island.line/v1");

function AgentSessionLine({ showTitle, agentIcon }: LineContext) {
  const agentSession = agentLine.use();
  if (!agentSession) return null;
  return (
    <span className="island__agent-session" key={`${agentSession.label}:${agentSession.title}`}>
      {showTitle && <span className="island__agent-session-separator">·</span>}
      {agentIcon ?? (agentSession.provider ? (
        <AgentProviderIcon provider={agentSession.provider} size={16} />
      ) : (
        <Bot className="island__agent-session-bot" size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      ))}
      <span className="island__agent-session-title">{agentSession.title}</span>
    </span>
  );
}

lineSlot.add({ id: "agent-status.session", component: AgentSessionLine }, OWNER);
