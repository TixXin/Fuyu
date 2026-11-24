import { useState } from "react";
import { FolderOpen } from "lucide-react";
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
import "./ProjectsSessionsView.css";

type ProjectFilter = "all" | "active";

type ProjectBucket = {
  key: string;
  name: string;
  host: string | null;
  reveal?: () => void;
  items: SessionViewItem[];
};

export function ProjectsSessionsView({
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
  const [filter, setFilter] = useState<ProjectFilter>("all");

  const visible = filter === "active" ? items.filter((item) => item.active) : items;
  const map = new Map<string, ProjectBucket>();
  for (const item of visible) {
    const name = item.project ?? text.noProject;
    const host = item.session.remoteHost ?? null;
    const key = `${host ?? ""}::${name}`;
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
      if (!existing.reveal && item.onReveal) existing.reveal = item.onReveal;
    } else {
      map.set(key, { key, name, host, reveal: item.onReveal, items: [item] });
    }
  }
  const buckets = [...map.values()];

  return (
    <div className="agent-view agent-view--projects">
      <div className="agent-v__bar" role="tablist" aria-label={text.title}>
        <button
          type="button"
          role="tab"
          aria-selected={filter === "all"}
          className={`agent-v__tab${filter === "all" ? " agent-v__tab--on" : ""}`}
          onClick={() => setFilter("all")}
        >
          <span>{viewText.projectsAll}</span>
          <span className="agent-v__count">{items.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === "active"}
          className={`agent-v__tab${filter === "active" ? " agent-v__tab--on" : ""}`}
          onClick={() => setFilter("active")}
        >
          <span>{viewText.projectsActive}</span>
          <span className="agent-v__count">{items.filter((item) => item.active).length}</span>
        </button>
      </div>
      <ul
        ref={listRef}
        className={`agent-sessions__list agent-sessions__list--projects${hasRemoval ? " agent-sessions__list--archivable" : ""}${hasMenu ? " agent-sessions__list--menu" : ""}`}
        data-fade-top={fade.top || undefined}
        data-fade-bottom={fade.bottom || undefined}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        onContextMenu={onContextMenu}
      >
        {buckets.length === 0 ? (
          <li className="agent-v__empty-filter">{viewText.filterEmpty}</li>
        ) : (
          buckets.flatMap((bucket) => {
            const activeCount = bucket.items.filter((item) => item.active).length;
            return [
              <li key={`proj:${bucket.key}`} className="agent-projects__head" data-session-key={`proj:${bucket.key}`}>
                <span className="agent-projects__name">
                  <FolderOpen size={13} aria-hidden="true" />
                  <span>{bucket.name}</span>
                  {bucket.host && <span className="agent-v__remote">{bucket.host}</span>}
                </span>
                <span className="agent-projects__stat">
                  {viewText.projectCount(bucket.items.length, activeCount)}
                </span>
                {bucket.reveal && (
                  <button type="button" className="agent-projects__open" onClick={bucket.reveal}>
                    {viewText.openFolder}
                  </button>
                )}
              </li>,
              ...bucket.items.map((item, idx) => {
                const isLast = idx === bucket.items.length - 1;
                const button = (
                  <button
                    type="button"
                    className={`agent-session agent-projects__row${isLast ? " agent-projects__row--last" : ""} agent-session--${item.session.phase} ${effectClasses(item, cardEffects, false)}`}
                    onClick={item.onOpen}
                  >
                    <SessionCardFx effects="off" orbit={item.orbit} />
                    <SessionStatusSlot item={item} />
                    <span className="agent-projects__mid">
                      <span className="agent-v__title">{item.title}</span>
                      {item.notFound ? (
                        <span className="agent-session__not-found" role="status">{item.notFound}</span>
                      ) : item.active ? (
                        <SessionActivityStrip item={item} showActivity={showActivity} minimal />
                      ) : null}
                    </span>
                    <span className="agent-projects__col3">
                      {showModel && item.active && <SessionModelInline item={item} />}
                      <SessionProviderMark item={item} hostDisplay={hostDisplay} size={14} />
                    </span>
                    <span className="agent-session__time">{item.showAge && <span className="agent-session__age">{item.age}</span>}</span>
                  </button>
                );
                return (
                  <li key={item.key} data-session-key={item.key} className={`agent-projects__item${isLast ? " agent-projects__item--last" : ""}`}>
                    <SessionHoverWrap item={item}>{button}</SessionHoverWrap>
                    {item.subagents}
                    {item.menu}
                    {item.archive}
                  </li>
                );
              }),
            ];
          })
        )}
      </ul>
    </div>
  );
}
