import type { CSSProperties } from "react";
import { AgentProviderIcon } from "../AgentProviderIcon";
import type { AgentNoticeStackItem } from "./noticeStack.ts";
import "./AgentNoticeStack.css";

export function AgentNoticeRing({ item, size }: { item: AgentNoticeStackItem; size: number }) {
  return (
    <span className={`agent-notice-stack__ring agent-notice-stack--tone-${item.tone}`} style={{ "--stack-icon": `${size}px` } as CSSProperties}>
      <AgentProviderIcon provider={item.provider} size={size} />
    </span>
  );
}
