import { useMemo } from "react";
import { useTranslation } from "../../../i18n";
import type { IslandSettings } from "../../../lib/settings/types";
import type { IslandContribution } from "../../plugin-kernel/islandContributions";
import type { IslandHost } from "../../plugin-kernel/islandHost";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { useHostChangeEvent } from "../../plugins/useHostChangeEvent";
import type { AgentSessionSummary } from "../api";
import { AGENT_POPUP_LIST_SAVING, getAgentAlertExpandedHeight } from "../islandLayout";
import { listAgentStatuses } from "../status";
import { useAgentIndicator } from "../useAgentIndicator";
import { useIslandAgentAlerts } from "../useIslandAgentAlerts";
import { useIslandAgents } from "../useIslandAgents";
import { useQuotaAlert } from "../useQuotaAlert";
import { demoAgentSessions } from "./demo";
import { agentPage, agentShell, quotaAlertState } from "./islandState";

type RunnerProps = {
  mode: string;
  isTucked: boolean;
  quiet: boolean;
  page: string;
  settings: IslandSettings;
  features: { agents: boolean };
  demo: { active: boolean; startedAt: number };
  openIslandPage: (page: "agents") => void;
  collapseIsland: () => void;
  host: IslandHost;
};

const NO_SESSIONS: AgentSessionSummary[] = [];
const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function AgentRunner({ mode, isTucked, quiet, page, settings, features, demo, openIslandPage, collapseIsland, host }: RunnerProps) {
  const t = useTranslation();
  const demoSessions = useMemo(() => (demo.active ? demoAgentSessions(t.onboarding.demo, demo.startedAt) : NO_SESSIONS), [demo.active, demo.startedAt, t]);
  const { agentStatus, agentSessions, listedAgentSessions, activeAgentSessionCount, unseenAgentSessions, agentRemoval, agentSession, agentInterjection, agentActivity, agentUsages } =
    useIslandAgents(settings, demoSessions);
  const quotaAlert = useQuotaAlert(agentUsages, settings.agentStatusEnabled ? settings.agentQuotaAlertPercent : 0, {
    quiet,
    canPopUp: !quiet && mode === "collapsed" && !isTucked,
  });
  const { alertedSession, approvals, agentCardHeight, alertPopup } = useIslandAgentAlerts({
    sessions: agentSessions,
    unseen: unseenAgentSessions.keys,
    settings,
    enabled: features.agents && !quiet,
    mode,
    page,
    openIslandPage,
    collapseIsland,
    host,
  });
  const { agentVisualState, agentStatusLabel } = useAgentIndicator(agentStatus, settings, activeAgentSessionCount, t);
  useHostChangeEvent("agentStatus.changed", [agentStatus], () => ({
    agents: listAgentStatuses(agentStatus).map(({ key, label, status }) => ({
      id: key,
      name: label,
      phase: status.phase,
      ...(status.title ? { title: status.title } : {}),
    })),
  }));
  agentPage.useProvide(useMemo(
    () => ({ sessions: listedAgentSessions, unseen: unseenAgentSessions, removal: agentRemoval, usages: agentUsages, alerted: alertedSession, approvals }),
    [listedAgentSessions, unseenAgentSessions, agentRemoval, agentUsages, alertedSession, approvals],
  ));
  quotaAlertState.useProvide(quotaAlert);
  agentShell.useProvide(useMemo(
    () => ({ sessions: agentSessions, listed: listedAgentSessions, unseenKeys: unseenAgentSessions.keys, activeCount: activeAgentSessionCount, named: agentSession, interjection: agentInterjection, activity: agentActivity }),
    [agentSessions, listedAgentSessions, unseenAgentSessions.keys, activeAgentSessionCount, agentSession, agentInterjection, agentActivity],
  ));
  const waiting = agentSessions.some((session) => session.phase === "waiting");
  const busy = agentSessions.some((session) => session.phase === "running" || session.phase === "waiting");
  const list: IslandContribution[] = [
    { kind: "status", state: agentVisualState, label: agentStatusLabel },
    { kind: "popup", page: "agents", height: agentCardHeight !== undefined ? getAgentAlertExpandedHeight(agentCardHeight) : undefined, saving: AGENT_POPUP_LIST_SAVING, open: alertPopup },
  ];
  if (quotaAlert) list.push({ kind: "alert", item: "quota" });
  if (settings.autoTuckHoldAgent && settings.agentStatusEnabled && waiting) list.push({ kind: "hold", reason: "agent-status.waiting" });
  if (settings.agentStatusEnabled && activeAgentSessionCount > 0) list.push({ kind: "hint", key: "agent" });
  if (busy) list.push({ kind: "hint", key: "agents.busy" });
  useIslandContributions("builtin", "agent-status.island", list);
  return null;
}

runnerSlot.add({ id: "agent-status.runner", component: AgentRunner });
