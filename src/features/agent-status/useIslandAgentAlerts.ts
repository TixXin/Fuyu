import { useEffect, useLayoutEffect, useRef } from "react";
import type { AgentSessionSummary } from "./api";
import { sessionKey } from "./unseen";
import { useAgentApprovals } from "./approvals/useAgentApprovals";
import { useAgentApprovalSettings } from "./approvals/useAgentApprovalSettings";
import { alertKindsOf, useAgentAlerts } from "./useAgentAlerts";
import { useAgentTestNotice } from "./useAgentTestNotice";
import { useAgentSounds } from "./sounds/useAgentSounds";
import { useAgentPush } from "./push/useAgentPush";
import { reminderSound } from "./sounds/events";
import { playAgentSound } from "./sounds/player";
import { useAgentSoundSettings } from "./sounds/useAgentSoundSettings";
import type { IslandSettings } from "../../lib/settings/types";
import type { IslandHost } from "../plugin-kernel/islandHost";
import { useIslandHovered } from "../plugin-kernel/useHoverHold";
import { useOutsideClick } from "../plugin-kernel/useOutsideClick";

type IslandAgentAlertsOptions = {
  sessions: AgentSessionSummary[];
  unseen: ReadonlySet<string>;
  settings: IslandSettings;
  enabled: boolean;
  mode: string;
  page: string;
  openIslandPage: (page: "agents") => void;
  collapseIsland: () => void;
  host: IslandHost;
};

export function useIslandAgentAlerts({ sessions, unseen, settings, enabled, mode, page, openIslandPage, collapseIsland, host }: IslandAgentAlertsOptions) {
  const isOpenOnAgents = mode === "expanded" && page === "agents";
  const autoOpenedRef = useRef(false);
  const onOpen = () => {
    autoOpenedRef.current = true;
    openIslandPage("agents");
  };
  const [approvalSettings] = useAgentApprovalSettings();
  const approvals = useAgentApprovals({ enabled: enabled && approvalSettings.onIsland, whenInFront: approvalSettings.whenInFront, isOpenOnAgents, onOpen, onClose: collapseIsland });
  const waiting = approvals.current !== null;
  const waitingRef = useRef(waiting);
  useLayoutEffect(() => {
    waitingRef.current = waiting;
  }, [waiting]);

  useEffect(() => {
    const takeOver = (event: PointerEvent) => {
      if (!(event.target instanceof Element && event.target.closest(".agent-approval"))) autoOpenedRef.current = false;
    };
    window.addEventListener("pointerdown", takeOver, true);
    return () => window.removeEventListener("pointerdown", takeOver, true);
  }, []);

  const wasOpenOnAgentsRef = useRef(isOpenOnAgents);
  useEffect(() => {
    if (wasOpenOnAgentsRef.current && !isOpenOnAgents) autoOpenedRef.current = false;
    wasOpenOnAgentsRef.current = isOpenOnAgents;
  }, [isOpenOnAgents]);

  const wasWaitingRef = useRef(waiting);
  useEffect(() => {
    const ended = wasWaitingRef.current && !waiting;
    wasWaitingRef.current = waiting;
    if (ended && autoOpenedRef.current && isOpenOnAgents) {
      autoOpenedRef.current = false;
      collapseIsland();
    }
  }, [waiting, isOpenOnAgents, collapseIsland]);

  useAgentSounds(sessions, enabled, unseen);
  useAgentPush(sessions, settings.agentStatusEnabled, unseen);
  const isHovered = useIslandHovered(host);
  const [soundSettings] = useAgentSoundSettings();
  const remind = (reminded: AgentSessionSummary[]) => {
    const event = reminderSound(reminded[reminded.length - 1]);
    if (soundSettings.enabled && soundSettings.events[event]) playAgentSound(event, soundSettings);
  };
  const { alerted: alertedSession, stack: alertedStack, showTest, dismissTest } = useAgentAlerts({
    sessions,
    kinds: alertKindsOf(settings),
    dwell: {
      completedMs: settings.agentAlertSeconds * 1000,
      yourTurnMs: settings.agentNoticeYourTurnSeconds * 1000,
      failedMs: settings.agentNoticeFailedSeconds * 1000,
      hoverHold: settings.agentNoticeHoverHold,
    },
    canAlert: enabled,
    isOpenOnAgents,
    isCollapsed: mode === "collapsed",
    onOpen,
    onClose: () => {
      if (!waitingRef.current) collapseIsland();
    },
    remindAfterMs: settings.agentRemindSeconds * 1000,
    onRemind: remind,
    looked: (session) => !unseen.has(sessionKey(session)),
    isHovered,
  });
  const shownApprovals = useAgentTestNotice({ cards: approvalSettings.onIsland, approvals, alerted: alertedSession, showTest, dismissTest, sounds: soundSettings });
  const mustHandle = alertedSession?.session.phase === "waiting";
  useOutsideClick(alertedSession !== null && !mustHandle && !waiting && isOpenOnAgents, collapseIsland, host);
  const agentCardHeight = shownApprovals.current ? shownApprovals.cardHeight : alertedSession?.rowHeight;
  const alertPopup = alertedSession !== null && !shownApprovals.current && isOpenOnAgents;
  return { alertedSession, alertedStack, approvals: shownApprovals, agentCardHeight, alertPopup };
}
