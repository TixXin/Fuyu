import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { listenAgentApprovalHotkey, setAgentApprovalHotkeys, type AgentApprovalDecision, type APPROVAL_HOTKEYS } from "./api";
import type { AgentApprovals } from "./useAgentApprovals";

export const APPROVAL_ARM_MS = 500;

export function useApprovalCard(approvals: AgentApprovals, hotkeys: typeof APPROVAL_HOTKEYS) {
  const [armed, setArmed] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const actRef = useRef<(action: AgentApprovalDecision) => void>(() => {});
  const { measure } = approvals;
  const id = approvals.current?.id;

  useEffect(() => {
    setArmed(false);
    const timer = window.setTimeout(() => setArmed(true), APPROVAL_ARM_MS);
    return () => window.clearTimeout(timer);
  }, [id]);

  useEffect(() => {
    if (!armed || !id) return;
    const failed = (error: unknown) => console.error("Failed to set the approval shortcuts", error);
    let stop: (() => void) | undefined;
    let cancelled = false;
    void listenAgentApprovalHotkey((action) => actRef.current(action))
      .then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)))
      .catch(failed);
    void setAgentApprovalHotkeys(hotkeys).catch(failed);
    return () => {
      cancelled = true;
      stop?.();
      void setAgentApprovalHotkeys([]).catch(failed);
    };
  }, [armed, id, hotkeys]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const report = () => measure(card.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(card);
    return () => observer.disconnect();
  }, [measure, id]);

  return { armed, cardRef, actRef };
}
