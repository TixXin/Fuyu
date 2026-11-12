import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { agentSessionsInFront } from "../api";
import {
  decideAgentApproval,
  getPendingAgentApprovals,
  setAgentApprovalEnabled,
  listenAgentApprovalClosed,
  listenAgentApprovalRequested,
  type AgentApprovalDecision,
  type AgentQuestionAnswers,
  type AgentApprovalRequest,
} from "./api";

const DEFAULT_CARD_HEIGHT = 118;

export type AgentApprovals = {
  current: AgentApprovalRequest | null;
  queued: number;
  decide: (decision: AgentApprovalDecision, answers?: AgentQuestionAnswers) => void;
  cardHeight: number;
  measure: (height: number) => void;
};

type AgentApprovalOptions = {
  enabled: boolean;
  whenInFront?: boolean;
  isOpenOnAgents: boolean;
  onOpen: () => void;
  onClose: () => void;
};

const TYPING_RETRY_MS = 1000;

function isTyping() {
  const element = document.activeElement;
  return element instanceof HTMLElement && (element.isContentEditable || element.matches("input, textarea"));
}

function report(error: unknown) {
  console.error("Failed to answer an agent permission request", error);
}

export function useAgentApprovals({ enabled, whenInFront = false, isOpenOnAgents, onOpen, onClose }: AgentApprovalOptions): AgentApprovals {
  const [queue, setQueue] = useState<AgentApprovalRequest[]>([]);
  const [cardHeight, setCardHeight] = useState(DEFAULT_CARD_HEIGHT);
  const openedRef = useRef(false);
  const latest = useRef({ enabled, whenInFront, isOpenOnAgents, onOpen, onClose });
  useLayoutEffect(() => {
    latest.current = { enabled, whenInFront, isOpenOnAgents, onOpen, onClose };
  });

  const drop = useCallback((id: number) => setQueue((items) => items.filter((item) => item.id !== id)), []);

  useEffect(() => {
    const handBack = (request: AgentApprovalRequest) => {
      void decideAgentApproval(request.id, "terminal").catch(report);
    };
    const admit = (request: AgentApprovalRequest) => {
      if (!latest.current.enabled) return handBack(request);
      const queue = () => setQueue((items) => (items.some((item) => item.id === request.id) ? items : [...items, request]));
      if (latest.current.whenInFront) return queue();
      void agentSessionsInFront([{ provider: request.agent, sessionId: request.sessionId }])
        .catch(() => [] as string[])
        .then((inFront) => {
          if (inFront.includes(request.sessionId) || !latest.current.enabled) handBack(request);
          else queue();
        });
    };

    let cancelled = false;
    const stops: (() => void)[] = [];
    const keep = (stop: () => void) => (cancelled ? stop() : stops.push(stop));
    void listenAgentApprovalRequested(admit).then(keep).catch(report);
    void listenAgentApprovalClosed((closed) => drop(closed.id)).then(keep).catch(report);
    void getPendingAgentApprovals()
      .then((pending) => {
        if (!cancelled) pending.forEach(admit);
      })
      .catch(report);
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, [drop]);

  useEffect(() => {
    void setAgentApprovalEnabled(enabled).catch(report);
  }, [enabled]);

  useEffect(() => {
    if (enabled || queue.length === 0) return;
    queue.forEach((request) => void decideAgentApproval(request.id, "terminal").catch(report));
    setQueue([]);
  }, [enabled, queue]);

  const current = queue[0] ?? null;
  const currentId = current?.id ?? null;
  useEffect(() => {
    if (currentId === null) {
      if (openedRef.current && latest.current.isOpenOnAgents) latest.current.onClose();
      openedRef.current = false;
      return;
    }
    let timer: number | undefined;
    const open = () => {
      if (latest.current.isOpenOnAgents) return;
      if (isTyping()) {
        timer = window.setTimeout(open, TYPING_RETRY_MS);
        return;
      }
      openedRef.current = true;
      latest.current.onOpen();
    };
    open();
    return () => window.clearTimeout(timer);
  }, [currentId]);

  useEffect(() => {
    if (!isOpenOnAgents) openedRef.current = false;
  }, [isOpenOnAgents]);

  const decide = useCallback(
    (decision: AgentApprovalDecision, answers?: AgentQuestionAnswers) => {
      if (!current) return;
      drop(current.id);
      void decideAgentApproval(current.id, decision, undefined, answers).catch(report);
    },
    [current, drop],
  );

  return useMemo(
    () => ({ current, queued: Math.max(0, queue.length - 1), decide, cardHeight, measure: setCardHeight }),
    [current, queue.length, decide, cardHeight],
  );
}
