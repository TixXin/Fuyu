import { BellOff, KeyRound, MailPlus, RefreshCw, TriangleAlert } from "lucide-react";
import { useTranslation } from "../../../i18n";
import type { MessageSource } from "../messagePreview";
import type { FeedActions, FeedSourceState } from "../feed/types";

const ICONS = { off: BellOff, access: KeyRound, auth: KeyRound, setup: MailPlus, error: TriangleAlert } as const;

export function FeedNotices({ sources, actions, only, compact = false }: {
  sources: readonly FeedSourceState[];
  actions: FeedActions;
  only?: MessageSource | null;
  compact?: boolean;
}) {
  const t = useTranslation();
  const feed = t.messages.feed;
  const shown = sources.filter((source) => source.status !== "ok" && source.status !== "waiting" && (!only || source.id === only));
  if (shown.length === 0) return null;
  return (
    <div className="feed-notices">
      {shown.map((source) => {
        const status = source.status as keyof typeof ICONS;
        const Icon = ICONS[status];
        const hint = status === "error" ? source.error : feed.noticeHint[status];
        const run = status === "off" ? () => actions.enable(source.id) : status === "error" ? () => actions.refresh(source.id) : () => actions.fix(source.id);
        const label = status === "off" ? feed.turnOn : status === "error" ? feed.refresh : status === "access" ? feed.grant : feed.fixInSettings;
        const canRun = !(status === "access" && source.id === "wechat");
        return (
          <div className="feed-notice" data-status={status} key={source.id} role="status">
            <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
            <span className="feed-notice__text"><strong>{feed.notice[status](source.label)}</strong>{!compact && hint ? <span>{hint}</span> : null}</span>
            {canRun && <button type="button" className="feed-button feed-button--solid" disabled={source.busy} onClick={run}>{status === "error" && <RefreshCw size={13} strokeWidth={1.9} aria-hidden="true" />}{label}</button>}
          </div>
        );
      })}
    </div>
  );
}
