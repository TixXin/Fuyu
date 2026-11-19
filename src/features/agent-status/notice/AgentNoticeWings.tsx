import type { AgentNoticeNotch, AgentNoticeStack as StackMode } from "../agentSettings";
import { AgentNoticePile } from "./AgentNoticePile";
import { AgentNoticeRing } from "./AgentNoticeRing";
import { activeIndex, type AgentNoticeStackItem } from "./noticeStack.ts";
import "./AgentNoticeStack.css";
import "./AgentNoticeWings.css";

export function AgentNoticeWings({ mode, notch, items, activeKey }: {
  mode: StackMode;
  notch: AgentNoticeNotch;
  items: readonly AgentNoticeStackItem[];
  activeKey: string | null;
}) {
  const index = activeIndex(items, activeKey);
  const active = items[index];
  if (notch !== "band" || !active) return null;
  return (
    <div className="agent-notice-stack__notch" data-island-notch-band="" aria-hidden="true">
      <span className="agent-notice-stack__wing agent-notice-stack__wing--left">
        {mode === "wings" && items.length > 1 ? <AgentNoticePile items={items} index={index} label={null} onOpen={null} /> : <AgentNoticeRing item={active} size={16} />}
      </span>
      <span className="agent-notice-stack__camera" />
      <span className={`agent-notice-stack__wing agent-notice-stack__wing--right agent-notice-stack--tone-${active.tone}`}>
        <span className="agent-notice-stack__state">{active.state}</span>
      </span>
    </div>
  );
}
