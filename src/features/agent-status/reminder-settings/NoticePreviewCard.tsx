import { useMemo, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "../../../i18n";
import type { IslandSettings } from "../../../lib/settings/types";
import { islandInkRgb, themeColors, type ThemeTone } from "../../../lib/theme/themeMode";
import { AgentApprovalCard } from "../approvals/AgentApprovalCard";
import { AgentQuestionCard } from "../approvals/AgentQuestionCard";
import type { AgentApprovals } from "../approvals/useAgentApprovals";
import { AgentNoticeStack, type AgentNoticeStackSlot } from "../notice/AgentNoticeStack";
import { AgentNoticeWings } from "../notice/AgentNoticeWings";
import { AgentSessionNotice } from "../notice/AgentSessionNotice";
import { noticeOptionsOf } from "../notice/noticeOptions";
import { stackItemOf, type AgentNoticeStackItem } from "../notice/noticeStack";
import type { PreviewEvent } from "./previewEvents";
import { previewSamples } from "./previewSamples";
import "./NoticePreviewCard.css";

const nothing = () => {};

function frameStyle(settings: IslandSettings, tone: ThemeTone) {
  const colors = themeColors(settings, tone);
  return {
    "--agent-ink": islandInkRgb(colors),
    "--island-shell-fill": colors.islandBackgroundColor,
    background: colors.islandBackgroundColor,
  } as CSSProperties;
}

export function NoticePreviewCard({
  event,
  settings,
  tone,
  notch,
  onDecide = nothing,
}: {
  event: PreviewEvent;
  settings: IslandSettings;
  tone: ThemeTone;
  notch: boolean;
  onDecide?: () => void;
}) {
  const t = useTranslation();
  const samples = useMemo(() => previewSamples(t.settings.agentNotice.preview.sample), [t]);
  const options = noticeOptionsOf(settings);
  const mode = settings.agentNoticeStack;
  const placement = notch ? settings.agentNoticeNotch : "below";
  const states = t.agentNotice.state;

  let items: AgentNoticeStackItem[];
  let card: (slot: AgentNoticeStackSlot) => ReactNode;
  const statusInBand = notch && placement === "band";
  if (event === "approval" || event === "question") {
    const request = samples.requests[event];
    const approvals: AgentApprovals = { current: request, queued: 0, decide: onDecide, cardHeight: 0, measure: nothing };
    const sessions = [samples.sessions[event]];
    items = [{ key: "approval", provider: request.agent, tone: "needs", title: "", state: states[event === "question" ? "question" : "needs"] }];
    card = () =>
      event === "question" ? (
        <AgentQuestionCard approvals={approvals} sessions={sessions} options={options} preview statusInBand={statusInBand} />
      ) : (
        <AgentApprovalCard approvals={approvals} sessions={sessions} options={options} preview statusInBand={statusInBand} />
      );
  } else {
    const entries = event === "stack" ? samples.stack : [samples.sessions[event]];
    const session = entries[0];
    items = entries.map((entry) => stackItemOf(entry.sessionId, entry, states));
    card = ({ count, icon }) => (
      <AgentSessionNotice session={session} options={options} model={session.model} count={count} icon={icon} onOpen={nothing} onOpenAgentPage={nothing} statusInBand={statusInBand} />
    );
  }

  return (
    <div
      className={`agent-reminder-frame${notch ? ` agent-reminder-frame--notch-${placement}` : ""}`}
      data-notice-notch={notch && placement === "band" ? "on" : undefined}
      style={frameStyle(settings, tone)}
    >
      {notch && <span className="agent-reminder-frame__notch" aria-hidden="true" />}
      <AgentNoticeWings mode={mode} notch={placement} items={items} activeKey={items[0].key} />
      <AgentNoticeStack mode={mode} notch={placement} items={items} activeKey={items[0].key} onSelect={nothing}>
        {card}
      </AgentNoticeStack>
    </div>
  );
}

export function NoticePreviewPill({ settings, tone, notch, title, state }: {
  settings: IslandSettings;
  tone: ThemeTone;
  notch: boolean;
  title: string;
  state: string | null;
}) {
  return (
    <div className={`agent-reminder-pill${notch ? " agent-reminder-pill--notch" : ""}`} style={frameStyle(settings, tone)}>
      {state && <i className="agent-reminder-pill__dot" aria-hidden="true" />}
      <span className="agent-reminder-pill__title">{title}</span>
      {state && <span className="agent-reminder-pill__state">{state}</span>}
    </div>
  );
}
