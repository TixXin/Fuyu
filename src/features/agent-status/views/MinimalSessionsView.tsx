import { useState, type CSSProperties } from "react";
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
import type { SessionViewProps } from "./types";
import "./MinimalSessionsView.css";

export function MinimalSessionsView({
  items,
  hostDisplay,
  showModel,
  showActivity,
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = items.find((item) => item.key === selectedKey) ?? items[0] ?? null;
  const selectedCwd = selected?.session.cwd
    ? selected.session.remoteHost ? `${selected.session.remoteHost}:${selected.session.cwd}` : selected.session.cwd
    : null;

  return (
    <div className="agent-view agent-view--minimal">
      <ul
        ref={listRef}
        className={`agent-sessions__list agent-sessions__list--minimal${hasRemoval ? " agent-sessions__list--archivable" : ""}${hasMenu ? " agent-sessions__list--menu" : ""}`}
        data-fade-top={fade.top || undefined}
        data-fade-bottom={fade.bottom || undefined}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        onContextMenu={onContextMenu}
      >
        {items.map((item) => {
          const isSelected = selected?.key === item.key;
          const button = (
            <button
              type="button"
              className={`agent-session agent-minimal__row${isSelected ? " agent-minimal__row--selected" : ""} agent-session--${item.session.phase} ${effectClasses(item, "off", false)}`}
              onFocus={() => setSelectedKey(item.key)}
              onMouseEnter={() => setSelectedKey(item.key)}
              onClick={item.onOpen}
            >
              <SessionCardFx effects="off" orbit={item.orbit} />
              <SessionStatusSlot item={item} />
              <span className="agent-minimal__body">
                <span className="agent-minimal__line1">
                  <span className="agent-minimal__proj">{item.project ?? "—"}</span>
                  <span className="agent-v__title">{item.title}</span>
                  <span className="agent-v__trailing">
                    {showModel && item.active && <SessionModelInline item={item} />}
                    <SessionProviderMark item={item} hostDisplay={hostDisplay} size={13} />
                    <span className="agent-session__time">{item.showAge && <span className="agent-session__age">{item.age}</span>}</span>
                  </span>
                </span>
                {item.notFound ? (
                  <span className="agent-minimal__line2">
                    <span className="agent-session__not-found" role="status">{item.notFound}</span>
                  </span>
                ) : item.active ? (
                  <span className="agent-minimal__line2">
                    <SessionActivityStrip item={item} showActivity={showActivity} minimal />
                  </span>
                ) : null}
                {isSelected && showActivity && item.session.lastPrompt && (
                  <span className="agent-minimal__expand">{text.yourPrompt(item.session.lastPrompt)}</span>
                )}
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
        })}
      </ul>
      <div className="agent-minimal__footer" aria-hidden="true">
        <span className="agent-minimal__cwd">{selectedCwd ?? ""}</span>
        <span className="agent-minimal__keys">
          <span><kbd>↵</kbd>{viewText.keyFocus}</span>
          {hasRemoval && <span><kbd>⌫</kbd>{viewText.keyArchive}</span>}
        </span>
      </div>
    </div>
  );
}
