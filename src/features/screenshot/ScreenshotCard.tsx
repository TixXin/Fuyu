import { useState, type PointerEvent } from "react";
import { Bot, Inbox, X } from "lucide-react";
import { Menu } from "@tauri-apps/api/menu";
import { focusAgentWindow, type AgentSessionSummary } from "../agent-status/api";
import { addFileShelfPaths } from "../file-shelf/api";
import { useErrorText, useTranslation } from "../../i18n";
import { dragScreenshot, pasteScreenshotToFront } from "./api";
import type { ScreenshotCardState } from "./useScreenshotCard";
import "./ScreenshotCard.css";

/** A session's name in the menu: its title, else its folder, else the agent. */
function sessionName(session: AgentSessionSummary) {
  const folder = session.cwd?.split(/[\\/]/).filter(Boolean).pop();
  return session.title?.trim() || folder || session.provider;
}

/**
 * The last screenshot copied or saved, in one row over the top of the island (C41.5): drag the
 * thumbnail out as a file, put it on the file shelf, or send it to an agent (its terminal comes
 * forward and the picture is pasted as a file path, which Claude Code and Codex read as an
 * image). Local sessions only: a remote one cannot open a file on this computer.
 */
export function ScreenshotCard({ card, sessions }: { card: ScreenshotCardState; sessions: readonly AgentSessionSummary[] }) {
  const t = useTranslation().screenshot;
  const errorText = useErrorText();
  const [notice, setNotice] = useState<string | null>(null);
  const taken = card.current;
  if (!taken) return null;
  const local = sessions.filter((session) => !session.remoteHost);
  const report = (error: unknown) => setNotice(errorText(error));

  const send = async (session: AgentSessionSummary) => {
    const found = await focusAgentWindow(session.provider, session.cwd, session.title, session.sessionId);
    if (!found) {
      setNotice(t.card.agentNotFound);
      return;
    }
    await pasteScreenshotToFront(taken.path);
    card.dismiss();
  };

  const onSend = async () => {
    try {
      if (local.length === 1) {
        await send(local[0]);
        return;
      }
      const menu = await Menu.new({
        items: local.map((session) => ({ text: sessionName(session), action: () => void send(session).catch(report) })),
      });
      await menu.popup();
    } catch (error) {
      report(error);
    }
  };

  const onShelf = () => {
    addFileShelfPaths([taken.path]).then(() => setNotice(t.card.shelved), report);
  };

  const onDrag = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragScreenshot(taken.path).then(() => card.dismiss(), report);
  };

  return (
    <div
      className="screenshot-card"
      role="status"
      key={taken.path}
      onPointerEnter={card.hold}
      onPointerLeave={card.release}
    >
      {taken.thumbnail && (
        <img className="screenshot-card__thumb" src={taken.thumbnail} alt="" title={t.card.dragHint} draggable={false} onPointerDown={onDrag} />
      )}
      <span className="screenshot-card__text">{notice ?? (taken.saved ? t.card.saved : t.card.copied)}</span>
      <button className="screenshot-card__button" type="button" aria-label={t.card.shelf} title={t.card.shelf} onClick={onShelf}>
        <Inbox size={14} />
      </button>
      <button
        className="screenshot-card__button"
        type="button"
        aria-label={t.card.sendToAgent}
        title={local.length > 0 ? t.card.sendToAgent : t.card.noAgent}
        disabled={local.length === 0}
        onClick={() => void onSend()}
      >
        <Bot size={14} />
      </button>
      <button className="screenshot-card__button" type="button" aria-label={t.card.close} title={t.card.close} onClick={card.dismiss}>
        <X size={14} />
      </button>
    </div>
  );
}
