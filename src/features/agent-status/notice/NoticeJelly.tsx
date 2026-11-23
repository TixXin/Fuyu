import type { JellyMood } from "../../../components/jellyfish/JellyfishMark";
import { AgentProviderIcon } from "../AgentProviderIcon";
import { SessionJelly } from "../SessionLightMark";
import type { AgentNoticeTone } from "./noticeOptions";
import "./NoticeJelly.css";

const MOODS: Record<AgentNoticeTone, JellyMood> = { needs: "waiting", yourTurn: "waiting", working: "running", done: "done", failed: "failed" };

export function noticeMood(tone: AgentNoticeTone, compacting: boolean): JellyMood {
  return compacting ? "compacting" : MOODS[tone];
}

export type NoticeJellySize = "card" | "band" | "row";

const HEIGHTS: Record<NoticeJellySize, number> = { card: 24, band: 18, row: 16 };
const BADGES: Partial<Record<NoticeJellySize, number>> = { card: 12, band: 10 };

export function NoticeJelly({ mood, provider, size }: { mood: JellyMood; provider: string; size: NoticeJellySize }) {
  const badge = BADGES[size];
  return (
    <span className={`agent-notice__jelly agent-notice__jelly--${size}`}>
      <SessionJelly className="agent-notice__jelly-mark" mood={mood} height={HEIGHTS[size]} />
      {badge ? (
        <span className="agent-notice__badge">
          <AgentProviderIcon provider={provider} size={badge} />
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
