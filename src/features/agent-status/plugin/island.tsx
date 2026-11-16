import type { ComponentProps } from "react";
import type { ReactNode } from "react";
import type { Translations } from "../../../i18n";
import { Gauge, RotateCcw } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandAlertMeta, type IslandCollapsedMeta, type IslandHeaderMeta, type IslandPageMeta } from "../../plugin-kernel/slots";
import { AgentArrangeButton } from "../AgentArrangeButton";
import { QuotaAlertPopup } from "../QuotaAlertPopup";
import { AgentSessionsPanel } from "../AgentSessionsPanel";
import { agentArrange, agentPage, agentShell, quotaAlertState } from "./islandState";
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
  hints: ReadonlySet<string>;
  slots: { agentCount?: ReactNode };
  onOpenPage: (page: "agents") => void;
};

const collapsedSlot = defineSlot<CollapsedContext, IslandCollapsedMeta<CollapsedContext>>("island.collapsed/v1");

function SessionCountItem({ t, slots, onOpenPage }: CollapsedContext) {
  const agentSessionCount = agentShell.use().activeCount;
  if (slots.agentCount) return slots.agentCount;
  return (
    <button
      className="island-agent-count"
      type="button"
      aria-label={t.agent.sessions.activeCount(agentSessionCount)}
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
  shown: ({ hints, slots }) => hints.has("agents.count") && (Boolean(slots.agentCount) || hints.has("agent")),
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

type HeaderContext = { page: string };

const headerSlot = defineSlot<HeaderContext, IslandHeaderMeta<HeaderContext>>("island.header/v1");

function ArrangeButton() {
  const arrange = agentArrange.use();
  return arrange && <AgentArrangeButton sort={arrange.sort} group={arrange.group} onChange={arrange.onChange} />;
}

headerSlot.add({ id: "agent-arrange", order: 0, enabled: ({ page }) => page === "agents", component: ArrangeButton });
