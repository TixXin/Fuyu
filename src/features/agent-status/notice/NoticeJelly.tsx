import type { JellyMood } from "../../../components/jellyfish/JellyfishMark";
import { AgentProviderIcon } from "../AgentProviderIcon";
import { SessionJelly } from "../SessionLightMark";
import type { AgentNoticeTone } from "./noticeOptions";
import "./NoticeJelly.css";

const MOODS: Record<AgentNoticeTone, JellyMood> = { needs: "waiting", yourTurn: "waiting", working: "running", done: "done", failed: "failed" };

export function noticeMood(tone: AgentNoticeTone, compacting: boolean): JellyMood {
  return compacting ? "compacting" : MOODS[tone];
}

export function NoticeJelly({ mood, provider, badge }: { mood: JellyMood; provider: string; badge: boolean }) {
  return (
    <span className={`agent-notice__jelly${badge ? " agent-notice__jelly--badged" : ""}`}>
      <SessionJelly className="agent-notice__jelly-mark" mood={mood} height={badge ? 24 : 16} />
      {badge ? (
        <span className="agent-notice__badge">
          <AgentProviderIcon provider={provider} size={12} />
        </span>
      ) : null}
    </span>
  );
}

export function NoticeBrand({ provider }: { provider: string }) {
  return (
    <span className="agent-notice__brand">
      <AgentProviderIcon provider={provider} size={14} />
    </span>
  );
}
