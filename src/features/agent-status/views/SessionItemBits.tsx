import type { ReactNode } from "react";
import { useTranslation } from "../../../i18n";
import type { AgentCardEffects, AgentHostDisplay } from "../agentSettings";
import { AgentProviderIcon } from "../AgentProviderIcon";
import { AgentSessionHoverCard } from "../AgentSessionHoverCard";
import { SessionHostLabel } from "../SessionHostLabel";
import { SessionLightMark } from "../SessionLightMark";
import { splitToolDetail } from "../toolDetail";
import type { SessionViewItem } from "./types";

export function SessionStatusSlot({ item }: { item: SessionViewItem }) {
  return (
    <span className="agent-v__mark">
      <SessionLightMark
        light={item.light}
        compacting={item.session.compacting === true}
        quiet={item.looked}
        fresh={item.unseen}
        label={item.lightText}
      />
    </span>
  );
}

export function SessionModelInline({ item }: { item: SessionViewItem }) {
  const { pill, pillMode, pillTitle, session } = item;
  if (!pill.model && !pill.effort && !pillMode) return null;
  return (
    <span className="agent-v__model" title={pillTitle}>
      {pill.model && <span className="agent-v__model-name">{pill.model}</span>}
      {pill.effort && <span className="agent-v__model-effort">{pill.effort}</span>}
      {pillMode && <span className={`agent-v__model-mode agent-v__model-mode--${session.permissionMode}`}>{pillMode}</span>}
    </span>
  );
}

export function SessionProviderMark({ item, hostDisplay, size = 14 }: { item: SessionViewItem; hostDisplay: AgentHostDisplay; size?: number }) {
  const { session } = item;
  return (
    <>
      {session.host && (hostDisplay === "name" || hostDisplay === "both") && <SessionHostLabel host={session.host} display="name" />}
      <span className="agent-session__agent">
        <AgentProviderIcon provider={session.provider} size={size} />
        {session.host && <SessionHostLabel host={session.host} display={hostDisplay} badge />}
      </span>
    </>
  );
}

export function SessionActivityStrip({
  item,
  showActivity,
  minimal = false,
}: {
  item: SessionViewItem;
  showActivity: boolean;
  minimal?: boolean;
}) {
  const t = useTranslation();
  const { session, light, phaseLabel } = item;
  const tool = showActivity ? session.currentTool : null;
  const prompt = showActivity ? session.lastPrompt : null;
  const detail = tool?.detail ? splitToolDetail(tool.detail) : null;

  if (tool) {
    const label = tool.detail ? `${t.agent.sessions.toolCall(tool.name)}: ${tool.detail}` : t.agent.sessions.toolCall(tool.name);
    return (
      <span className={`agent-v__activity${minimal ? " agent-v__activity--minimal" : ""}${light === "needs" ? " agent-v__activity--needs" : ""}`} title={label}>
        <span className="agent-v__verb">{light === "needs" ? phaseLabel : minimal ? `› ${tool.name}` : tool.name}</span>
        {light === "needs" && <span className="agent-v__tool-inline">{tool.name}</span>}
        {detail && (
          <span className="agent-session__tool-detail">
            <span className="agent-session__tool-head">{detail.head}</span>
            {detail.tail && <span className="agent-session__tool-tail">{detail.tail}</span>}
          </span>
        )}
      </span>
    );
  }

  if (session.lastMessage) {
    return (
      <span className={`agent-v__activity${minimal ? " agent-v__activity--minimal" : ""}`}>
        {item.showPhase && <span className={`agent-v__verb agent-v__verb--${light}`}>{phaseLabel}</span>}
        <span className="agent-v__reply">{session.lastMessage}</span>
      </span>
    );
  }

  if (prompt) {
    return (
      <span className={`agent-v__activity${minimal ? " agent-v__activity--minimal" : ""}`}>
        {item.showPhase && <span className={`agent-v__verb agent-v__verb--${light}`}>{phaseLabel}</span>}
        <span className="agent-v__reply">{t.agent.sessions.yourPrompt(prompt)}</span>
      </span>
    );
  }

  if (item.showPhase) {
    return (
      <span className={`agent-v__activity${minimal ? " agent-v__activity--minimal" : ""}`}>
        <span className={`agent-v__verb agent-v__verb--${light}`}>{phaseLabel}</span>
      </span>
    );
  }

  return null;
}

export function SessionHoverWrap({ item, children }: { item: SessionViewItem; children: ReactNode }) {
  const fullTitle = item.project && item.project !== item.title ? `${item.project} · ${item.title}` : item.title;
  return (
    <AgentSessionHoverCard session={item.session} title={fullTitle} suppressed={item.hoverSuppressed}>
      {children}
    </AgentSessionHoverCard>
  );
}

export function SessionCardFx({ effects, orbit }: { effects: AgentCardEffects; orbit: boolean }) {
  return (
    <>
      {effects === "sparkle" && <span className="agent-card__band" aria-hidden="true" />}
      {orbit && <span className="agent-orbit-ring" aria-hidden="true" />}
    </>
  );
}

export function effectClasses(item: SessionViewItem, effects: AgentCardEffects, allowCardGlow: boolean) {
  const lively = (item.light === "needs" || item.light === "yourTurn" || item.light === "working" || item.light === "failed") && !item.looked;
  const parts = [
    `agent-v--light-${item.light}`,
    `agent-session--light-${item.light}`,
    lively && "agent-card--lively",
    item.unseen && "agent-session--unseen",
    item.looked && "agent-session--looked",
    allowCardGlow && effects !== "off" && effects !== "orbit" && `agent-card--${effects}`,
    item.orbit && "agent-session--orbit",
  ];
  return parts.filter(Boolean).join(" ");
}
