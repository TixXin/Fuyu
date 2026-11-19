import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode, Ref } from "react";
import { ArrowUpRight } from "lucide-react";
import { IslandHoverCard, type HoverCardLine } from "../../../components/IslandHoverCard";
import { AgentProviderIcon } from "../AgentProviderIcon";
import type { AgentNoticeScrollbar, AgentNoticeStyle } from "../agentSettings";
import type { AgentNoticeTone } from "./noticeOptions";
import "./AgentNoticeCard.css";

const HOVER_DELAY_MS = 600;
const INTERACTIVE = "button, a, input, textarea, fieldset, .agent-notice-message__thumb";

export type AgentNoticeCorner = { label: string; onClick: () => void };

export type AgentNoticeCardProps = {
  noticeStyle: AgentNoticeStyle;
  tone: AgentNoticeTone;
  provider: string;
  headline: string;
  state: string;
  title: string;
  titlePrefix?: string | null;
  scrollbar: AgentNoticeScrollbar;
  count?: string | null;
  meta?: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  hoverLines?: readonly HoverCardLine[] | null;
  onOpen?: (() => void) | null;
  corner?: AgentNoticeCorner | null;
  role?: "alertdialog" | "group";
  ariaLabel: string;
  cardRef?: Ref<HTMLElement>;
  className?: string;
};

export function AgentNoticeCard(props: AgentNoticeCardProps) {
  const { noticeStyle, tone, provider, headline, state, title, titlePrefix, scrollbar, count, meta, body, actions, hoverLines, onOpen, corner, role = "group", ariaLabel, cardRef, className } = props;
  const open = (event: MouseEvent<HTMLElement>) => {
    if (!onOpen || (event.target instanceof Element && event.target.closest(INTERACTIVE))) return;
    onOpen();
  };
  const openByKey = (event: KeyboardEvent<HTMLElement>) => {
    if (!onOpen || event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onOpen();
  };
  const titleText = (
    <span className="agent-notice__title" title={title}>
      {titlePrefix ? <span className="agent-notice__title-prefix">{titlePrefix} · </span> : null}
      {title}
    </span>
  );
  const countChip = count ? <span className="agent-notice__count">{count}</span> : null;
  const cornerButton = corner ? (
    <button className="agent-notice__corner" type="button" aria-label={corner.label} title={corner.label} onClick={corner.onClick}>
      <ArrowUpRight size={14} strokeWidth={2.2} aria-hidden="true" />
    </button>
  ) : null;
  const stateText = <span className="agent-notice__state">{state}</span>;
  const icon = (size: number) => (
    <span className="agent-notice__icon" style={{ "--notice-icon": `${size}px` } as CSSProperties}>
      <AgentProviderIcon provider={provider} size={size} />
    </span>
  );
  const bodyBlock = body || meta ? <div className="agent-notice__body">{meta}{body}</div> : null;

  let content: ReactNode;
  if (noticeStyle === "wings") {
    content = (
      <>
        <div className="agent-notice__band">
          {icon(16)}
          {tone === "working" ? titleText : <span className="agent-notice__spacer" />}
          {stateText}
          {countChip}
          {cornerButton}
        </div>
        <div className="agent-notice__drop">
          {tone === "working" ? null : titleText}
          {bodyBlock}
          {actions}
        </div>
      </>
    );
  } else if (noticeStyle === "compact") {
    content = (
      <>
        <div className="agent-notice__row">
          {icon(16)}
          {titleText}
          {stateText}
          {countChip}
          {cornerButton}
        </div>
        {bodyBlock}
        {actions}
      </>
    );
  } else {
    content = (
      <>
        <div className="agent-notice__main">
          {icon(26)}
          <div className="agent-notice__content">
            <div className="agent-notice__row">
              <span className="agent-notice__headline">{headline}</span>
              {countChip}
              {cornerButton}
            </div>
            {titleText}
            {bodyBlock}
          </div>
        </div>
        {actions}
      </>
    );
  }

  const card = (
    <section
      ref={cardRef}
      className={`agent-notice agent-notice--${noticeStyle} agent-notice--tone-${tone}${scrollbar === "always" ? " agent-notice--scrollbar-always" : ""}${onOpen ? " agent-notice--opens" : ""}${className ? ` ${className}` : ""}`}
      role={role}
      aria-label={ariaLabel}
      tabIndex={onOpen ? 0 : undefined}
      onClick={open}
      onKeyDown={openByKey}
    >
      {content}
    </section>
  );
  if (!hoverLines?.length) return card;
  return (
    <IslandHoverCard lines={hoverLines} delayMs={HOVER_DELAY_MS} anchorClassName="agent-notice-hover" cardClassName="agent-session-hover-card">
      {card}
    </IslandHoverCard>
  );
}
