import { useState } from "react";
import { AppWindow, Archive, ArrowLeft, Copy, FolderOpen } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { AgentProviderIcon } from "../AgentProviderIcon";
import { listedSubagents } from "../AgentSubagents";
import { formatTokens } from "../sessionList";
import { getAgentProviderLabel } from "../status";
import { effectClasses, SessionProviderMark, SessionStatusSlot } from "./SessionItemBits";
import type { SessionViewItem, SessionViewProps } from "./types";
import "./SplitSessionsView.css";

export function SplitSessionsView({
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
  const [narrowDetail, setNarrowDetail] = useState(false);

  const selected = items.find((item) => item.key === selectedKey) ?? items[0] ?? null;
  const activeItems = items.filter((item) => item.active);
  const doneItems = items.filter((item) => !item.active);

  const renderMasterRow = (item: SessionViewItem) => {
    const isSelected = selected?.key === item.key;
    return (
      <li key={item.key} data-session-key={item.key}>
        <button
          type="button"
          aria-current={isSelected ? "true" : undefined}
          className={`agent-session agent-split__item agent-session--${item.session.phase}${isSelected ? " agent-split__item--selected" : ""} ${effectClasses(item, "off", false)}`}
          onFocus={() => setSelectedKey(item.key)}
          onClick={() => {
            setSelectedKey(item.key);
            setNarrowDetail(true);
          }}
          onDoubleClick={item.onOpen}
        >
          <SessionStatusSlot item={item} />
          <span className="agent-split__mid">
            <span className="agent-v__title">{item.title}</span>
            <span className="agent-split__sub">
              {item.project && item.project !== item.title && <span>{item.project}</span>}
              {item.project && item.project !== item.title && <span>·</span>}
              <span className={`agent-split__phase agent-split__phase--${item.light}`}>{item.phaseLabel}</span>
            </span>
          </span>
          <span className="agent-split__right">
            <SessionProviderMark item={item} hostDisplay={hostDisplay} size={13} />
            <span className="agent-split__age">{item.age}</span>
          </span>
        </button>
        {item.menu}
      </li>
    );
  };

  const subs = selected ? listedSubagents(selected.session) : [];
  const cwdText = selected?.session.cwd
    ? selected.session.remoteHost ? `${selected.session.remoteHost}:${selected.session.cwd}` : selected.session.cwd
    : null;

  return (
    <div className={`agent-view agent-view--split${narrowDetail ? " agent-view--split-detail" : ""}`}>
      <ul
        ref={listRef}
        className={`agent-sessions__list agent-split__master${hasRemoval ? " agent-sessions__list--archivable" : ""}${hasMenu ? " agent-sessions__list--menu" : ""}`}
        data-fade-top={fade.top || undefined}
        data-fade-bottom={fade.bottom || undefined}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        onContextMenu={onContextMenu}
      >
        {activeItems.length > 0 && (
          <>
            <li className="agent-split__section" aria-hidden="true">{viewText.activeSection(activeItems.length)}</li>
            {activeItems.map(renderMasterRow)}
          </>
        )}
        {doneItems.length > 0 && (
          <>
            <li className="agent-split__section" aria-hidden="true">{viewText.recentDone(doneItems.length)}</li>
            {doneItems.map(renderMasterRow)}
          </>
        )}
      </ul>
      {selected && (
        <div className="agent-split__detail">
          <button type="button" className="agent-split__back" onClick={() => setNarrowDetail(false)}>
            <ArrowLeft size={13} aria-hidden="true" />
            <span>{viewText.backToList}</span>
          </button>
          <div className="agent-split__d-top">
            {cwdText ? (
              <span className="agent-split__crumb" title={cwdText}>
                <FolderOpen size={12} aria-hidden="true" />
                <span>{cwdText}</span>
              </span>
            ) : <span />}
            <span className={`agent-split__badge agent-split__badge--${selected.light}`}>{selected.phaseLabel}</span>
          </div>
          <h3 className="agent-split__d-title">{selected.title}</h3>
          <div className="agent-split__chips">
            <span className="agent-split__chip">
              <AgentProviderIcon provider={selected.session.provider} size={13} />
              <span>{getAgentProviderLabel(selected.session.provider)}</span>
              {selected.session.host && <span className="agent-split__chip-dim">· {selected.session.host.name}</span>}
            </span>
            {showModel && selected.model && <span className="agent-split__chip agent-split__chip--mono">{selected.model}</span>}
            {selected.pillMode && <span className={`agent-split__chip agent-v__model-mode--${selected.session.permissionMode}`}>{selected.pillMode}</span>}
            {selected.session.contextTokens ? (
              <span className="agent-split__chip agent-split__chip--mono">{text.contextTokens(formatTokens(selected.session.contextTokens))}</span>
            ) : null}
          </div>
          {selected.notFound && <p className="agent-split__notice" role="status">{selected.notFound}</p>}
          {showActivity && selected.session.lastPrompt && (
            <div className="agent-split__prompt">{text.yourPrompt(selected.session.lastPrompt)}</div>
          )}
          <div className="agent-split__console">
            {showActivity && selected.session.currentTool ? (
              <>
                <div className="agent-split__console-head">
                  <span>{text.toolCall(selected.session.currentTool.name)}</span>
                  <span>{selected.age}</span>
                </div>
                {selected.session.currentTool.detail && (
                  <code className="agent-split__code">{selected.session.currentTool.detail}</code>
                )}
              </>
            ) : selected.session.lastMessage ? (
              <>
                <div className="agent-split__console-head">
                  <span>{viewText.latestReply}</span>
                  <span>{selected.age}</span>
                </div>
                <p className="agent-split__reply">{selected.session.lastMessage}</p>
              </>
            ) : (
              <p className="agent-split__reply agent-split__reply--empty">{selected.phaseLabel}</p>
            )}
            {subs.length > 0 && (
              <div className="agent-split__subs">
                <span className="agent-split__subs-title">{text.subagents(subs.length)}</span>
                {subs.map((sub) => (
                  <span key={sub.id} className="agent-split__sub-row">
                    <span className="agent-split__sub-dot" aria-hidden="true" />
                    <span className="agent-split__sub-name">{sub.description || sub.agentType || sub.id}</span>
                    <span className="agent-split__sub-tool">{sub.currentTool?.name ?? text.subagentThinking}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="agent-split__foot">
            <button
              type="button"
              className={`agent-split__cta${selected.light === "needs" ? " agent-split__cta--needs" : ""}`}
              onClick={selected.onOpen}
            >
              <AppWindow size={13} aria-hidden="true" />
              <span>{text.menu.focus}</span>
            </button>
            {selected.onReveal && (
              <button type="button" className="agent-split__action" onClick={selected.onReveal}>
                <FolderOpen size={13} aria-hidden="true" />
                <span>{viewText.folderShort}</span>
              </button>
            )}
            {selected.onCopyPath && (
              <button type="button" className="agent-split__action" onClick={selected.onCopyPath} aria-label={text.menu.copyPath} title={text.menu.copyPath}>
                <Copy size={13} aria-hidden="true" />
              </button>
            )}
            {selected.onArchive && (
              <button type="button" className="agent-split__action agent-split__action--end" onClick={selected.onArchive}>
                <Archive size={13} aria-hidden="true" />
                <span>{text.menu.archive}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
