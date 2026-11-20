import { useEffect, useState, type CSSProperties } from "react";
import { Check, CheckCheck, SquareTerminal, X } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { focusAgentWindow, type AgentSessionSummary } from "../api";
import { sessionProject } from "../sessionList";
import { AGENT_PROVIDER_LABELS } from "../status";
import { AgentNoticeCard } from "../notice/AgentNoticeCard";
import { NoticeActions, type NoticeAction } from "../notice/NoticeActions";
import { approvalCommandLines, DEFAULT_AGENT_NOTICE_OPTIONS, type AgentNoticeOptions } from "../notice/noticeOptions";
import { APPROVAL_HOTKEYS, type AgentApprovalDecision } from "./api";
import type { AgentApprovals } from "./useAgentApprovals";
import { useApprovalCard } from "./useApprovalCard";
import { alwaysAllowRule, approvalPreview } from "./preview";
import "./AgentApprovalCard.css";

export { APPROVAL_ARM_MS } from "./useApprovalCard";

export function AgentApprovalCard({
  approvals,
  sessions,
  options = DEFAULT_AGENT_NOTICE_OPTIONS,
  preview: inPreview = false,
  statusInBand = false,
}: {
  approvals: AgentApprovals;
  sessions: AgentSessionSummary[];
  options?: AgentNoticeOptions;
  preview?: boolean;
  statusInBand?: boolean;
}) {
  const t = useTranslation();
  const request = approvals.current;
  const [expanded, setExpanded] = useState(false);
  const id = request?.id;
  const { armed, cardRef, actRef } = useApprovalCard(approvals, APPROVAL_HOTKEYS, !inPreview);

  useEffect(() => {
    setExpanded(false);
  }, [id]);

  if (!request) return null;
  const labels = t.agent.approval;
  const copy = t.agentNotice;
  const session = approvals.sample ?? sessions.find((item) => item.provider === request.agent && item.sessionId === request.sessionId);
  const cwd = session?.cwd ?? request.cwd;
  const project = sessionProject(cwd);
  const title = session?.title ?? project ?? AGENT_PROVIDER_LABELS[request.agent];
  const prefix = [request.remoteHost, project && project !== title ? project : null].filter(Boolean).join(" · ") || null;
  const preview = approvalPreview(request.toolInput);
  const rule = request.agent === "claudeCode" ? alwaysAllowRule(request.permissionSuggestions) : null;

  const toTerminal = () => {
    approvals.decide("terminal");
    if (inPreview || approvals.sample) return;
    void focusAgentWindow(request.agent, cwd, session?.title ?? null, request.remoteHost ? "" : request.sessionId).catch((error: unknown) =>
      console.error("Failed to focus the agent window", error),
    );
  };
  actRef.current = (action) => {
    if (action === "terminal") toTerminal();
    else if (action !== "allowAlways" || rule) approvals.decide(action);
  };
  const keyOf = (action: AgentApprovalDecision) => (options.showKeys ? APPROVAL_HOTKEYS.find((hotkey) => hotkey.action === action)?.shortcut : undefined);
  const actions: NoticeAction[] = [
    { id: "deny", label: labels.deny, icon: X, disabled: !armed, shortcut: keyOf("deny"), onClick: () => approvals.decide("deny") },
    { id: "terminal", label: labels.terminal, icon: SquareTerminal, disabled: !armed, shortcut: keyOf("terminal"), hint: labels.terminalHint, onClick: toTerminal },
    ...(rule ? [{ id: "always", label: labels.allowAlways, icon: CheckCheck, disabled: !armed, hint: labels.allowAlwaysHint(rule), onClick: () => approvals.decide("allowAlways") }] : []),
    { id: "allow", label: labels.allow, icon: Check, disabled: !armed, primary: true, shortcut: keyOf("allow"), onClick: () => approvals.decide("allow") },
  ];

  return (
    <AgentNoticeCard
      key={request.id}
      className="agent-approval"
      noticeStyle={options.style}
      tone="needs"
      provider={request.agent}
      headline={statusInBand ? request.toolName : copy.headline.needs(request.toolName)}
      state={copy.state.needs}
      title={title}
      titlePrefix={prefix}
      scrollbar={options.scrollbar}
      count={approvals.queued > 0 ? labels.more(approvals.queued) : null}
      role="alertdialog"
      ariaLabel={`${title} · ${labels.label(request.toolName)}`}
      cardRef={cardRef}
      body={
        <>
          {preview.note && <p className="agent-approval__note">{preview.note}</p>}
          <button
            className={`agent-approval__preview agent-approval__preview--${preview.kind}${expanded ? " agent-approval__preview--expanded" : ""}`}
            type="button"
            aria-expanded={expanded}
            title={expanded ? labels.collapse : labels.expand}
            style={{ "--notice-command-lines": approvalCommandLines(options.commandLines) } as CSSProperties}
            onClick={() => setExpanded((value) => !value)}
          >
            {preview.text}
          </button>
        </>
      }
      actions={<NoticeActions actions={actions} order={options.buttonOrder} showKeys={options.showKeys} />}
    />
  );
}
