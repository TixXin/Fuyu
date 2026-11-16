import type { ComponentProps } from "react";
import type { ReactNode } from "react";
import type { Translations } from "../../../i18n";
import { Gauge, RotateCcw } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandAlertMeta, type IslandCollapsedMeta, type IslandPageMeta } from "../../plugin-kernel/slots";
import { QuotaAlertPopup } from "../QuotaAlertPopup";
import { AgentSessionsPanel } from "../AgentSessionsPanel";
import { agentPage, quotaAlertState } from "./islandState";
import { islandPage } from "./page.ts";

type Panel = ComponentProps<typeof AgentSessionsPanel>;

type AgentsPageProps = {
  settings: {
    agentSessionView: Panel["view"];
    agentSessionSort: Panel["sort"];
    agentSessionGroup: Panel["group"];
    agentArchiveMotion: Panel["archiveMotion"];
    agentCardEffects: Panel["cardEffects"];
    agentHostDisplay: Panel["hostDisplay"];
    agentShowElapsed: Panel["showElapsed"];
    agentShowModel: Panel["showModel"];
    agentShowActivity: Panel["showActivity"];
    agentShowUsage: Panel["showUsage"];
  };
};

const pageSlot = defineSlot<AgentsPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function AgentsPage({ settings }: AgentsPageProps) {
  const agents = agentPage.use();
  if (!agents) return null;
  return <AgentSessionsPanel sessions={agents.sessions} view={settings.agentSessionView} sort={settings.agentSessionSort} group={settings.agentSessionGroup} archiveMotion={settings.agentArchiveMotion} cardEffects={settings.agentCardEffects} hostDisplay={settings.agentHostDisplay} showElapsed={settings.agentShowElapsed} showModel={settings.agentShowModel} showActivity={settings.agentShowActivity} unseen={agents.unseen} removal={agents.removal} reveal={agents.alerted} showUsage={settings.agentShowUsage} usages={agents.usages} approvals={agents.approvals} />;
}

pageSlot.add({ ...islandPage, component: AgentsPage });

type CollapsedContext = {
  t: Translations;
  agentSessionCount: number | null;
  slots: { agentCount?: ReactNode };
  onOpenPage: (page: "agents") => void;
};

const collapsedSlot = defineSlot<CollapsedContext, IslandCollapsedMeta<CollapsedContext>>("island.collapsed/v1");

function SessionCountItem({ t, agentSessionCount, slots, onOpenPage }: CollapsedContext) {
  if (slots.agentCount) return slots.agentCount;
  return (
    <button
      className="island-agent-count"
      type="button"
      aria-label={t.agent.sessions.activeCount(agentSessionCount ?? 0)}
      onClick={(event) => {
        event.stopPropagation();
        onOpenPage("agents");
      }}
    >
      {agentSessionCount}
    </button>
  );
}

collapsedSlot.add({
  id: "session-count",
  order: 80,
  shown: ({ agentSessionCount, slots }) => agentSessionCount !== null && (Boolean(slots.agentCount) || agentSessionCount > 0),
  component: SessionCountItem,
});

const alertSlot = defineSlot<object, IslandAlertMeta<object>>("island.alert/v1");

function QuotaAlertLeading() {
  const quotaAlert = quotaAlertState.use();
  if (!quotaAlert) return null;
  const Icon = quotaAlert.kind === "low" ? Gauge : RotateCcw;
  return (
    <span className={`notch-alert__icon agent-quota-alert agent-quota-alert--${quotaAlert.kind}`} aria-hidden="true">
      <Icon className="agent-quota-alert__icon" size={16} strokeWidth={2.2} />
    </span>
  );
}

function QuotaAlertTrailing() {
  const t = useTranslation();
  const quotaAlert = quotaAlertState.use();
  if (!quotaAlert) return null;
  const text = t.agent.quota;
  const agent = quotaAlert.agent === "claude" ? "Claude" : "Codex";
  const span = quotaAlert.window === "fiveHour" ? text.fiveHour : text.sevenDay;
  const low = quotaAlert.kind === "low";
  const label = low ? text.low(agent, span, Math.round(quotaAlert.used)) : text.reset(agent, span);
  return (
    <span className={`notch-alert__value agent-quota-alert agent-quota-alert--${quotaAlert.kind}`} role="status" aria-label={label}>
      <span className="agent-quota-alert__text" aria-hidden="true">{low ? `${Math.round(quotaAlert.used)}%` : span}</span>
    </span>
  );
}

function QuotaAlertBody() {
  const quotaAlert = quotaAlertState.use();
  return quotaAlert ? <QuotaAlertPopup alert={quotaAlert} /> : null;
}

alertSlot.add({ id: "quota", order: 20, component: QuotaAlertLeading, trailing: QuotaAlertTrailing, popup: QuotaAlertBody });
