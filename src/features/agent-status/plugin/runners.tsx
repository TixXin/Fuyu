import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "../../../i18n";
import type { IslandSettings } from "../../../lib/settings/types";
import { ISLAND_SIDE_ROW_HEIGHT, type IslandContribution } from "../../plugin-kernel/islandContributions";
import { useIslandDecor } from "../../plugin-kernel/islandDecor";
import type { IslandHost } from "../../plugin-kernel/islandHost";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributed, useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import type { AgentSessionSummary } from "../api";
import { AGENT_POPUP_LIST_SAVING, getAgentAlertExpandedHeight } from "../islandLayout";
import { listAgentStatuses } from "../status";
import { useAgentHostEvent } from "../useAgentHostEvent";
import { useAgentIndicator } from "../useAgentIndicator";
import { useIslandAgentAlerts } from "../useIslandAgentAlerts";
import { useIslandAgents } from "../useIslandAgents";
import { useQuotaAlert } from "../useQuotaAlert";
import { demoAgentSessions } from "./demo";
import { agentFeed, agentFeedOf, announceAgentsChanged } from "./agentFeed";
import { agentLineContribution, pickAgentSession } from "./agentLine";
import { agentArrange, agentLine, agentPage, agentShell, quotaAlertState, type AgentArrange } from "./islandState";
import { OWNER } from "./owner.ts";

type RunnerProps = {
  mode: string;
  isTucked: boolean;
  quiet: boolean;
  page: string;
  settings: IslandSettings;
  setSettings: Dispatch<SetStateAction<IslandSettings>>;
  features: { agents: boolean };
  demo: { active: boolean; startedAt: number };
  openIslandPage: (page: "agents") => void;
  collapseIsland: () => void;
  host: IslandHost;
};

const NO_SESSIONS: AgentSessionSummary[] = [];
const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function AgentRunner({ mode, isTucked, quiet, page, settings, setSettings, features, demo, openIslandPage, collapseIsland, host }: RunnerProps) {
  const t = useTranslation();
  const demoSessions = useMemo(() => (demo.active ? demoAgentSessions(t.onboarding.demo, demo.startedAt) : NO_SESSIONS), [demo.active, demo.startedAt, t]);
  const { agentStatus, agentSessions, listedAgentSessions, activeAgentSessionCount, unseenAgentSessions, agentRemoval, agentSession, agentInterjection, agentActivity, agentOthers, agentUsages } =
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
  useAgentHostEvent([agentStatus], () => ({
    agents: listAgentStatuses(agentStatus).map(({ key, label, status }) => ({
      id: key,
      name: label,
      phase: status.phase,
      ...(status.title ? { title: status.title } : {}),
    })),
  }));
  const feed = useMemo(() => agentFeedOf(agentSessions, listedAgentSessions, unseenAgentSessions.keys, agentOthers), [agentSessions, listedAgentSessions, unseenAgentSessions.keys, agentOthers]);
  agentFeed.useProvide(feed);
  useEffect(() => announceAgentsChanged(feed.sessions.length), [feed]);
  agentPage.useProvide(useMemo(
    () => ({ sessions: listedAgentSessions, unseen: unseenAgentSessions, removal: agentRemoval, usages: agentUsages, alerted: alertedSession, approvals }),
    [listedAgentSessions, unseenAgentSessions, agentRemoval, agentUsages, alertedSession, approvals],
  ));
  quotaAlertState.useProvide(quotaAlert);
  const arrangeChange = useCallback<AgentArrange["onChange"]>((patch) => setSettings((current) => ({ ...current, ...patch })), [setSettings]);
  agentArrange.useProvide(useMemo(() => ({ sort: settings.agentSessionSort, group: settings.agentSessionGroup, onChange: arrangeChange }), [settings.agentSessionSort, settings.agentSessionGroup, arrangeChange]));
  agentShell.useProvide(useMemo(
    () => ({ sessions: agentSessions, listed: listedAgentSessions, unseenKeys: unseenAgentSessions.keys, activeCount: activeAgentSessionCount, named: agentSession, interjection: agentInterjection, activity: agentActivity }),
    [agentSessions, listedAgentSessions, unseenAgentSessions.keys, activeAgentSessionCount, agentSession, agentInterjection, agentActivity],
  ));
  const { lines } = useIslandContributed();
  const iconWidth = useIslandDecor().agentIconWidth ?? 0;
  const lineSession = pickAgentSession(lines, settings.agentTitleMode, agentSession, agentInterjection);
  agentLine.useProvide(lineSession);
  const line = agentLineContribution(lineSession, lineSession !== null && lineSession === agentInterjection, iconWidth, lineSession ? t.island.agentSession(lineSession.label, lineSession.title) : "");
  const waiting = agentSessions.some((session) => session.phase === "waiting");
  const busy = agentSessions.some((session) => session.phase === "running" || session.phase === "waiting");
  const list: IslandContribution[] = [
    { kind: "status", state: agentVisualState, label: agentStatusLabel },
    { kind: "popup", page: "agents", height: agentCardHeight !== undefined ? getAgentAlertExpandedHeight(agentCardHeight) : undefined, saving: AGENT_POPUP_LIST_SAVING, open: alertPopup },
  ];
  list.push({ kind: "side", item: "agent", height: ISLAND_SIDE_ROW_HEIGHT });
  if (line) list.push(line);
  if (features.agents) list.push({ kind: "hint", key: "agents.count" });
  if (quotaAlert) list.push({ kind: "alert", item: "quota" });
  if (settings.autoTuckHoldAgent && settings.agentStatusEnabled && waiting) list.push({ kind: "hold", reason: "agent-status.waiting" });
  if (settings.agentStatusEnabled && activeAgentSessionCount > 0) list.push({ kind: "hint", key: "agent" });
  if (busy) list.push({ kind: "hint", key: "agents.busy" });
  useIslandContributions(OWNER, "agent-status.island", list);
  return null;
}

runnerSlot.add({ id: "agent-status.runner", component: AgentRunner }, OWNER);
