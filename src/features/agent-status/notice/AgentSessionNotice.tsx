import type { CSSProperties, ReactNode, Ref } from "react";
import { useTranslation } from "../../../i18n";
import type { AgentSessionSummary } from "../api";
import { sessionHoverLines } from "../focusHint";
import { SessionElapsed } from "../SessionElapsed";
import { durationParts, isActivePhase, sessionProject, turnElapsedMs } from "../sessionList";
import { getAgentProviderLabel } from "../status";
import { AgentNoticeCard, type AgentNoticeCorner } from "./AgentNoticeCard";
import { NoticeMessage } from "./NoticeMessage";
import { approvalCommandLines, HOVER_COMMAND_LINES, messageLineCap, noticeTone, type AgentNoticeOptions } from "./noticeOptions";
import "./AgentSessionNotice.css";

function NoticeCommand({ tool, detail, lines, label }: { tool: string; detail: string | null; lines: number; label?: string }) {
  return (
    <>
      {label && <div className="agent-notice__wants">{label}</div>}
      <div className="agent-notice__tool">
        {!label && <b className="agent-notice__tool-name">{tool}</b>}
        {detail && (
          <div className="agent-notice__command" style={{ "--notice-command-lines": lines, "--notice-command-hover": HOVER_COMMAND_LINES } as CSSProperties}>
            {detail}
          </div>
        )}
      </div>
    </>
  );
}

export function AgentSessionNotice({
  session,
  options,
  model,
  count,
  icon,
  onOpen,
  onOpenAgentPage,
  cardRef,
  statusInBand = false,
}: {
  session: AgentSessionSummary;
  options: AgentNoticeOptions;
  model: string | null;
  count?: string | null;
  icon?: ReactNode;
  onOpen: () => void;
  onOpenAgentPage?: (() => void) | null;
  cardRef?: Ref<HTMLElement>;
  statusInBand?: boolean;
}) {
  const t = useTranslation();
  const copy = t.agentNotice;
  const tone = noticeTone(session);
  const project = sessionProject(session.cwd);
  const provider = getAgentProviderLabel(session.provider);
  const title = session.title ?? project ?? provider;
  const tool = session.currentTool ?? null;
  const headline = statusInBand
    ? (tone === "working" || tone === "needs" ? tool?.name ?? "" : "")
    : tone === "working" ? copy.headline.working(tool?.name ?? null)
      : tone === "needs" ? (tool ? copy.headline.needs(tool.name) : copy.state.needs)
      : copy.headline[tone];

  let body = null;
  if (tone === "working" && tool) {
    body = <NoticeCommand tool={tool.name} detail={tool.detail} lines={options.commandLines} />;
  } else if (tone === "needs" && tool) {
    body = <NoticeCommand tool={tool.name} detail={tool.detail ?? tool.name} lines={approvalCommandLines(options.commandLines)} label={copy.wants(tool.name)} />;
  } else if (session.lastMessage && tone !== "working" && tone !== "needs") {
    body = <NoticeMessage text={session.lastMessage} lines={messageLineCap(options.messageLines)} markdown={options.markdown} />;
  }

  const fullTitle = project && project !== title ? `${project} · ${title}` : title;
  const elapsed = turnElapsedMs(session, Date.now());
  const modelLine = [model, elapsed === null ? null : t.agent.sessions.duration(durationParts(elapsed))].filter(Boolean).join(" · ");
  const [titleLine, ...restLines] = sessionHoverLines(session, fullTitle, t.agent.sessions.hover);
  const hoverLines = options.meta === "hover" ? [titleLine, ...(modelLine ? [{ text: modelLine, muted: true }] : []), ...restLines] : null;
  const meta = options.meta === "inline" && (model || session.lastPrompt || session.turnStartedAt !== null) ? (
    <div className="agent-notice__meta">
      {model && <span>{model}</span>}
      {session.turnStartedAt !== null && <SessionElapsed session={session} />}
      {session.lastPrompt && <span>{copy.you(session.lastPrompt)}</span>}
    </div>
  ) : null;

  const toPage = onOpenAgentPage ?? null;
  const opensPage = options.click === "page" && toPage !== null;
  const corner: AgentNoticeCorner | null = opensPage
    ? { label: copy.focusWindow, onClick: onOpen }
    : toPage ? { label: copy.openPage, onClick: toPage } : null;

  return (
    <AgentNoticeCard
      noticeStyle={options.style}
      tone={tone}
      provider={session.provider}
      headline={headline}
      state={copy.state[tone]}
      title={title}
      titlePrefix={session.remoteHost ?? null}
      scrollbar={options.scrollbar}
      count={count}
      icon={icon}
      meta={meta}
      body={body}
      hoverLines={hoverLines}
      onOpen={opensPage ? toPage : onOpen}
      corner={corner}
      ariaLabel={`${fullTitle} · ${isActivePhase(session.phase) ? copy.state[tone] : headline}`}
      cardRef={cardRef}
    />
  );
}
