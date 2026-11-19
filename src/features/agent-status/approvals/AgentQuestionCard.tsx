import { useEffect, useMemo, useState } from "react";
import { Send, SquareTerminal } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { focusAgentWindow, type AgentSessionSummary } from "../api";
import { sessionProject } from "../sessionList";
import { AGENT_PROVIDER_LABELS } from "../status";
import { APPROVAL_HOTKEYS } from "./api";
import type { AgentApprovals } from "./useAgentApprovals";
import { AgentNoticeCard } from "../notice/AgentNoticeCard";
import { NoticeActions, type NoticeAction } from "../notice/NoticeActions";
import { DEFAULT_AGENT_NOTICE_OPTIONS, type AgentNoticeOptions } from "../notice/noticeOptions";
import { useApprovalCard } from "./useApprovalCard";
import { answerOf, answersFor, answersOnPick, EMPTY_PICK, parseQuestions, togglePick, type QuestionPick } from "./questions";
import "./AgentQuestionCard.css";

const QUESTION_HOTKEYS = APPROVAL_HOTKEYS.filter((hotkey) => hotkey.action === "terminal");

export function AgentQuestionCard({
  approvals,
  sessions,
  options = DEFAULT_AGENT_NOTICE_OPTIONS,
}: {
  approvals: AgentApprovals;
  sessions: AgentSessionSummary[];
  options?: AgentNoticeOptions;
}) {
  const t = useTranslation();
  const request = approvals.current;
  const id = request?.id;
  const questions = useMemo(() => parseQuestions(request?.toolInput), [request?.toolInput]);
  const [picks, setPicks] = useState<QuestionPick[]>([]);
  const { armed, cardRef, actRef } = useApprovalCard(approvals, QUESTION_HOTKEYS);

  useEffect(() => {
    setPicks([]);
  }, [id]);

  const session = request && sessions.find((item) => item.provider === request.agent && item.sessionId === request.sessionId);
  const cwd = session?.cwd ?? request?.cwd ?? null;
  const answers = answersFor(questions, picks);
  const instant = answersOnPick(questions);

  const toTerminal = () => {
    if (!request) return;
    approvals.decide("terminal");
    void focusAgentWindow(request.agent, cwd, session?.title ?? null, request.remoteHost ? "" : request.sessionId).catch((error: unknown) =>
      console.error("Failed to focus the agent window", error),
    );
  };
  actRef.current = (action) => {
    if (action === "terminal") toTerminal();
  };

  const update = (index: number, change: (pick: QuestionPick) => QuestionPick) =>
    setPicks((current) => questions.map((_, at) => (at === index ? change(current[at] ?? EMPTY_PICK) : current[at] ?? EMPTY_PICK)));
  const pick = (index: number, label: string) => {
    if (!armed) return;
    if (instant) {
      approvals.decide("answer", { [questions[0].question]: label });
      return;
    }
    update(index, (current) => togglePick(current, questions[index], label));
  };
  const submit = () => {
    if (armed && answers) approvals.decide("answer", answers);
  };

  const activeIndex = Math.max(0, questions.findIndex((_, index) => !answerOf(picks[index])));
  useEffect(() => {
    if (!armed) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && event.target.matches("input, textarea")) return;
      const digit = Number(event.key);
      const option = questions[activeIndex]?.options[digit - 1];
      if (!Number.isInteger(digit) || !option) return;
      event.preventDefault();
      pick(activeIndex, option.label);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!request) return null;
  const labels = t.agent.question;
  const project = sessionProject(cwd);
  const title = session?.title ?? project ?? AGENT_PROVIDER_LABELS[request.agent];
  const prefix = [request.remoteHost, project && project !== title ? project : null].filter(Boolean).join(" · ") || null;
  const terminalKey = options.showKeys ? QUESTION_HOTKEYS[0]?.shortcut : undefined;
  const actions: NoticeAction[] = [
    { id: "terminal", label: t.agent.approval.terminal, icon: SquareTerminal, disabled: !armed, shortcut: terminalKey, hint: t.agent.approval.terminalHint, onClick: toTerminal },
    ...(!instant || picks.some((item) => item?.text.trim())
      ? [{ id: "submit", label: labels.submit, icon: Send, disabled: !armed || !answers, primary: true, onClick: submit }]
      : []),
  ];

  return (
    <AgentNoticeCard
      key={request.id}
      className="agent-approval agent-question"
      noticeStyle={options.style}
      tone="yourTurn"
      provider={request.agent}
      headline={t.agentNotice.headline.question}
      state={t.agentNotice.state.question}
      title={title}
      titlePrefix={prefix}
      scrollbar={options.scrollbar}
      count={approvals.queued > 0 ? t.agent.approval.more(approvals.queued) : null}
      role="alertdialog"
      ariaLabel={`${title} · ${labels.label}`}
      cardRef={cardRef}
      body={questions.map((question, index) => {
        const current = picks[index] ?? EMPTY_PICK;
        return (
          <fieldset key={question.question} className="agent-question__item">
            <legend className="agent-question__text">
              {question.header && <span className="agent-question__header">{question.header}</span>}
              {question.question}
            </legend>
            <div className="agent-question__options" role={question.multiSelect ? "group" : "radiogroup"}>
              {question.options.map((option, at) => {
                const chosen = current.labels.includes(option.label);
                return (
                  <button
                    key={option.label}
                    className={`agent-question__option${chosen ? " agent-question__option--chosen" : ""}`}
                    type="button"
                    role={question.multiSelect ? "checkbox" : "radio"}
                    aria-checked={chosen}
                    disabled={!armed}
                    title={option.description || undefined}
                    onClick={() => pick(index, option.label)}
                  >
                    {index === activeIndex && at < 9 && <span className="agent-question__key" aria-hidden="true">{at + 1}</span>}
                    {option.label}
                  </button>
                );
              })}
            </div>
            <input
              className="agent-question__other"
              type="text"
              value={current.text}
              placeholder={labels.other}
              aria-label={`${question.question} · ${labels.other}`}
              onChange={(event) => update(index, (pick) => ({ ...pick, text: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
              }}
            />
          </fieldset>
        );
      })}
      actions={<NoticeActions actions={actions} order={options.buttonOrder} showKeys={options.showKeys} />}
    />
  );
}
