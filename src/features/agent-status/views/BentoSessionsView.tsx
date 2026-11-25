import { useTranslation } from "../../../i18n";
import {
  effectClasses,
  SessionActivityStrip,
  SessionCardFx,
  SessionHoverWrap,
  SessionModelInline,
  SessionProviderMark,
  SessionStatusSlot,
} from "./SessionItemBits";
import type { SessionViewItem, SessionViewProps } from "./types";
import "./BentoSessionsView.css";

export function BentoSessionsView({
  items,
  hostDisplay,
  showModel,
  showActivity,
  cardEffects,
  hasRemoval,
  hasMenu,
  listRef,
  fade,
  onScroll,
  onKeyDown,
  onContextMenu,
}: SessionViewProps) {
  const t = useTranslation();
  const viewText = t.agent.sessions.views;

  const spotlights = items.filter((item) => item.light === "needs" || item.light === "failed");
  const activeCards = items.filter((item) => item.active && item.light !== "needs" && item.light !== "failed");
  const doneItems = items.filter((item) => !item.active);

  const renderSpotlight = (item: SessionViewItem) => {
    const button = (
      <button
        type="button"
        className={`agent-card agent-bento__spotlight agent-session--${item.session.phase} ${effectClasses(item, cardEffects, true)}`}
        onClick={item.onOpen}
      >
        <SessionCardFx effects={cardEffects} orbit={item.orbit} />
        <SessionStatusSlot item={item} />
        <span className="agent-bento__spot-mid">
          <span className="agent-bento__spot-top">
            <span className="agent-bento__spot-tag">{item.phaseLabel}</span>
            {item.project && item.project !== item.title && <span className="agent-v__proj">{item.project}</span>}
            <span className="agent-v__title">{item.title}</span>
          </span>
          {item.notFound ? (
            <span className="agent-session__not-found" role="status">{item.notFound}</span>
          ) : (
            <SessionActivityStrip item={item} showActivity={showActivity} minimal />
          )}
        </span>
        <span className="agent-bento__spot-end">
          <SessionProviderMark item={item} hostDisplay={hostDisplay} size={14} />
          <span className="agent-session__time">{item.showAge && <span className="agent-session__age">{item.age}</span>}</span>
        </span>
      </button>
    );

    return (
      <li key={item.key} data-session-key={item.key} className="agent-bento__span">
        <SessionHoverWrap item={item}>{button}</SessionHoverWrap>
        {item.subagents}
        {item.menu}
        {item.archive}
      </li>
    );
  };

  const renderActiveCard = (item: SessionViewItem) => {
    const button = (
      <button
        type="button"
        className={`agent-card agent-bento__card agent-session--${item.session.phase} ${effectClasses(item, cardEffects, true)}`}
        onClick={item.onOpen}
      >
        <SessionCardFx effects={cardEffects} orbit={item.orbit} />
        <span className="agent-bento__card-head">
          <SessionStatusSlot item={item} />
          {item.project && item.project !== item.title && <span className="agent-v__proj">{item.project}</span>}
          <span className={`agent-bento__phase agent-bento__phase--${item.light}`}>{item.phaseLabel}</span>
          <span className="agent-bento__spacer" />
          <SessionProviderMark item={item} hostDisplay={hostDisplay} size={13} />
        </span>
        <span className="agent-v__title agent-bento__title">{item.title}</span>
        {item.notFound ? (
          <span className="agent-session__not-found" role="status">{item.notFound}</span>
        ) : (
          <SessionActivityStrip item={item} showActivity={showActivity} />
        )}
        <span className="agent-bento__foot">
          {showModel ? <SessionModelInline item={item} /> : <span />}
          {item.statusParts.length > 0 && <span className="agent-bento__extra">{item.statusParts}</span>}
          <span className="agent-bento__age">{item.age}</span>
        </span>
      </button>
    );

    return (
      <li key={item.key} data-session-key={item.key} className="agent-bento__cell">
        <SessionHoverWrap item={item}>{button}</SessionHoverWrap>
        {item.subagents}
        {item.menu}
        {item.archive}
      </li>
    );
  };

  const renderDonePill = (item: SessionViewItem) => {
    const button = (
      <button
        type="button"
        className={`agent-card agent-bento__done agent-session--${item.session.phase} ${effectClasses(item, "off", false)}`}
        onClick={item.onOpen}
      >
        <SessionStatusSlot item={item} />
        <span className="agent-v__title agent-bento__done-title">
          {item.project && item.project !== item.title && <span className="agent-bento__done-proj">{item.project} · </span>}
          {item.title}
        </span>
        <span className="agent-v__trailing">
          <SessionProviderMark item={item} hostDisplay={hostDisplay} size={13} />
          <span className="agent-session__time">{item.showAge && <span className="agent-session__age">{item.age}</span>}</span>
        </span>
      </button>
    );

    return (
      <li key={item.key} data-session-key={item.key} className="agent-bento__cell">
        <SessionHoverWrap item={item}>{button}</SessionHoverWrap>
        {item.menu}
        {item.archive}
      </li>
    );
  };

  return (
    <div className="agent-view agent-view--bento">
      <div className="agent-bento__summary">
        <span className="agent-bento__stat">
          <i className="agent-bento__dot agent-bento__dot--needs" aria-hidden="true" />
          <strong>{spotlights.length}</strong> {viewText.filterNeed}
        </span>
        <span className="agent-bento__stat">
          <i className="agent-bento__dot agent-bento__dot--working" aria-hidden="true" />
          <strong>{activeCards.length}</strong> {viewText.filterRun}
        </span>
        <span className="agent-bento__stat">
          <i className="agent-bento__dot agent-bento__dot--done" aria-hidden="true" />
          <span>{doneItems.length} {viewText.filterDone}</span>
        </span>
      </div>
      <ul
        ref={listRef}
        className={`agent-sessions__list agent-sessions__list--bento${hasRemoval ? " agent-sessions__list--archivable" : ""}${hasMenu ? " agent-sessions__list--menu" : ""}`}
        data-fade-top={fade.top || undefined}
        data-fade-bottom={fade.bottom || undefined}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        onContextMenu={onContextMenu}
      >
        {spotlights.map(renderSpotlight)}
        {activeCards.map(renderActiveCard)}
        {doneItems.length > 0 && (
          <li className="agent-bento__span agent-focused__section" data-session-key="section:done">
            <span>{viewText.recentDone(doneItems.length)}</span>
          </li>
        )}
        {doneItems.map(renderDonePill)}
      </ul>
    </div>
  );
}
