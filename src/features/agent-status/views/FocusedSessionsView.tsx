import { useState, type CSSProperties } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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

type FocusedFilter = "all" | "need" | "run" | "done";

export function FocusedSessionsView({
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
  const text = t.agent.sessions;
  const viewText = text.views;
  const [filter, setFilter] = useState<FocusedFilter>("all");
  const [collapseDone, setCollapseDone] = useState(false);

  const needCount = items.filter((item) => item.urgent).length;
  const runCount = items.filter((item) => item.active && !item.urgent).length;
  const doneCount = items.filter((item) => !item.active).length;

  const filtered = items.filter((item) => {
    if (filter === "need") return item.urgent;
    if (filter === "run") return item.active && !item.urgent;
    if (filter === "done") return !item.active;
    return true;
  });

  const activeItems: SessionViewItem[] = [];
  const doneItems: SessionViewItem[] = [];
  let currentBucket: SessionViewItem[] = activeItems;
  for (const item of filtered) {
    if (item.depth === 0) currentBucket = item.active ? activeItems : doneItems;
    currentBucket.push(item);
  }

  const renderActive = (item: SessionViewItem) => {
    const button = (
      <button
        type="button"
        className={`agent-session agent-focused__row agent-focused__row--active agent-session--${item.session.phase} ${effectClasses(item, cardEffects, true)}`}
        onClick={item.onOpen}
      >
        <SessionCardFx effects={cardEffects} orbit={item.orbit} />
        <SessionStatusSlot item={item} />
        <span className="agent-focused__main">
          <span className="agent-focused__heading">
            {item.project && item.project !== item.title && <span className="agent-v__proj">{item.project}</span>}
            {item.session.remoteHost && <span className="agent-v__remote">{item.session.remoteHost}</span>}
            <span className="agent-v__title">{item.title}</span>
            {showModel && <SessionModelInline item={item} />}
            <span className="agent-v__trailing">
              <SessionProviderMark item={item} hostDisplay={hostDisplay} size={14} />
              <span className="agent-session__time">{item.showAge && <span className="agent-session__age">{item.age}</span>}</span>
            </span>
          </span>
          <span className="agent-focused__sub">
            {item.notFound ? (
              <span className="agent-session__not-found" role="status">{item.notFound}</span>
            ) : (
              <SessionActivityStrip item={item} showActivity={showActivity} />
            )}
            {item.statusParts.length > 0 && !item.notFound && (
              <span className="agent-focused__status">{item.statusParts}</span>
            )}
          </span>
        </span>
      </button>
    );

    return (
      <li
        key={item.key}
        data-session-key={item.key}
        className={item.depth ? "agent-session-child" : undefined}
        style={item.depth ? ({ "--child-depth": item.depth } as CSSProperties) : undefined}
      >
        <SessionHoverWrap item={item}>{button}</SessionHoverWrap>
        {item.subagents}
        {item.menu}
        {item.archive}
      </li>
    );
  };

  const renderDone = (item: SessionViewItem) => {
    const button = (
      <button
        type="button"
        className={`agent-session agent-focused__row agent-focused__row--done agent-session--${item.session.phase} ${effectClasses(item, "off", false)}`}
        onClick={item.onOpen}
      >
        <SessionStatusSlot item={item} />
        {item.project && item.project !== item.title && <span className="agent-v__proj agent-v__proj--quiet">{item.project}</span>}
        {item.session.remoteHost && <span className="agent-v__remote">{item.session.remoteHost}</span>}
        <span className="agent-v__title">{item.title}</span>
        {item.notFound ? (
          <span className="agent-session__not-found" role="status">{item.notFound}</span>
        ) : null}
        <span className="agent-v__trailing">
          <SessionProviderMark item={item} hostDisplay={hostDisplay} size={13} />
          <span className="agent-session__time">{item.showAge && <span className="agent-session__age">{item.age}</span>}</span>
        </span>
      </button>
    );

    return (
      <li
        key={item.key}
        data-session-key={item.key}
        className={item.depth ? "agent-session-child" : undefined}
        style={item.depth ? ({ "--child-depth": item.depth } as CSSProperties) : undefined}
      >
        <SessionHoverWrap item={item}>{button}</SessionHoverWrap>
        {item.subagents}
        {item.menu}
        {item.archive}
      </li>
    );
  };

  const tabs: Array<{ id: FocusedFilter; label: string; count: number; alert?: boolean }> = [
    { id: "all", label: viewText.filterAll, count: items.length },
    { id: "need", label: viewText.filterNeed, count: needCount, alert: needCount > 0 },
    { id: "run", label: viewText.filterRun, count: runCount },
    { id: "done", label: viewText.filterDone, count: doneCount },
  ];

  return (
    <div className="agent-view agent-view--focused">
      <div className="agent-v__bar" role="tablist" aria-label={text.title}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            className={`agent-v__tab${filter === tab.id ? " agent-v__tab--on" : ""}`}
            onClick={() => setFilter(tab.id)}
          >
            <span>{tab.label}</span>
            <span className={`agent-v__count${tab.alert ? " agent-v__count--alert" : ""}`}>{tab.count}</span>
          </button>
        ))}
      </div>
      <ul
        ref={listRef}
        className={`agent-sessions__list agent-sessions__list--focused${hasRemoval ? " agent-sessions__list--archivable" : ""}${hasMenu ? " agent-sessions__list--menu" : ""}`}
        data-fade-top={fade.top || undefined}
        data-fade-bottom={fade.bottom || undefined}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        onContextMenu={onContextMenu}
      >
        {filtered.length === 0 ? (
          <li className="agent-v__empty-filter">{viewText.filterEmpty}</li>
        ) : (
          <>
            {activeItems.map(renderActive)}
            {doneItems.length > 0 && (
              <li className="agent-focused__section" data-session-key="section:done">
                <span>{viewText.recentDone(doneItems.length)}</span>
                {filter !== "done" && (
                  <button
                    type="button"
                    className="agent-focused__toggle"
                    aria-expanded={!collapseDone}
                    onClick={() => setCollapseDone((open) => !open)}
                  >
                    {collapseDone ? <ChevronRight size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
                    <span>{collapseDone ? viewText.expand : viewText.collapse}</span>
                  </button>
                )}
              </li>
            )}
            {(!collapseDone || filter === "done") && doneItems.map(renderDone)}
          </>
        )}
      </ul>
    </div>
  );
}
