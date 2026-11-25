import { lazy, type ComponentProps, type ReactNode } from "react";
import type { Translations } from "../../../i18n";
import { Gauge, RotateCcw } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandAlertMeta, type IslandCollapsedMeta, type IslandHeaderMeta, type IslandPageMeta } from "../../plugin-kernel/slots";
import { AgentArrangeButton } from "../AgentArrangeButton";
import { QuotaAlertPopup } from "../QuotaAlertPopup";
import type { AgentSessionsPanel as AgentSessionsPanelComponent } from "../AgentSessionsPanel";
import { SessionLightStyleContext } from "../SessionLightMark";
import type { AgentLightStyle } from "../../../lib/settings/types";
import type { AgentSettingValues } from "../agentSettings";
import { noticeOptionsOf, type AgentNoticeSettings } from "../notice/noticeOptions";
import { agentArrange, agentPage, agentShell, quotaAlertState } from "./islandState";
import { islandPage } from "./page.ts";
import { OWNER } from "./owner.ts";

const AgentSessionsPanel = lazy(() => import("../AgentSessionsPanel").then((m) => ({ default: m.AgentSessionsPanel })));
const AgentEmptyState = lazy(() => import("../AgentEmptyState").then((m) => ({ default: m.AgentEmptyState })));

type Panel = ComponentProps<typeof AgentSessionsPanelComponent>;

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
    agentExpandChildren: Panel["expandChildren"];
    agentNoticeStack: Panel["stackMode"];
    agentNoticeNotch: Panel["notch"];
  } & AgentNoticeSettings & Pick<AgentSettingValues, "agentUsageHidden" | "agentUsageTightest" | "agentUsageReset" | "agentUsageStyle" | "agentUsageLayout" | "agentEmptyStyle" | "agentSessionHours" | "agentHiddenProviders"> & { agentLightStyle: AgentLightStyle };
  onOpenSettings: (section: "agentConnect") => void;
};

const pageSlot = defineSlot<AgentsPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function AgentsPage({ settings, onOpenSettings }: AgentsPageProps) {
  const agents = agentPage.use();
  const onChange = agentArrange.use()?.onChange;
  const sessions = agentShell.use().sessions;
  if (!agents) return null;
  const usageView = { hidden: settings.agentUsageHidden, tightest: settings.agentUsageTightest, reset: settings.agentUsageReset, style: settings.agentUsageStyle, layout: settings.agentUsageLayout, agentsOff: settings.agentHiddenProviders, onChange };
  const empty = (
    <AgentEmptyState
      style={settings.agentEmptyStyle}
      sessions={sessions}
      sessionHours={settings.agentSessionHours}
      showUsage={settings.agentShowUsage === true}
      usages={agents.usages}
      usageView={usageView}
      onSettingsChange={onChange}
      onOpenConnect={() => onOpenSettings("agentConnect")}
    />
  );
  return <SessionLightStyleContext.Provider value={settings.agentLightStyle}><AgentSessionsPanel usageView={usageView} empty={empty} sessions={agents.sessions} view={settings.agentSessionView} sort={settings.agentSessionSort} group={settings.agentSessionGroup} archiveMotion={settings.agentArchiveMotion} cardEffects={settings.agentCardEffects} hostDisplay={settings.agentHostDisplay} showElapsed={settings.agentShowElapsed} showModel={settings.agentShowModel} showActivity={settings.agentShowActivity} expandChildren={settings.agentExpandChildren} unseen={agents.unseen} removal={agents.removal} reveal={agents.alerted} stack={agents.alertedStack} stackMode={settings.agentNoticeStack} notch={settings.agentNoticeNotch} onOpenAgentPage={agents.alerted?.openAgentPage} showUsage={settings.agentShowUsage} usages={agents.usages} approvals={agents.approvals} notice={noticeOptionsOf(settings)} /></SessionLightStyleContext.Provider>;
}

pageSlot.add({ ...islandPage, component: AgentsPage }, OWNER);

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
}, OWNER);

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

alertSlot.add({ id: "quota", order: 20, component: QuotaAlertLeading, trailing: QuotaAlertTrailing, popup: QuotaAlertBody }, OWNER);

type HeaderContext = { page: string };

const headerSlot = defineSlot<HeaderContext, IslandHeaderMeta<HeaderContext>>("island.header/v1");

function ArrangeButton() {
  const arrange = agentArrange.use();
  return arrange && <AgentArrangeButton view={arrange.view} sort={arrange.sort} group={arrange.group} onChange={arrange.onChange} />;
}

headerSlot.add({ id: "agent-arrange", order: 0, enabled: ({ page }) => page === "agents", component: ArrangeButton }, OWNER);
