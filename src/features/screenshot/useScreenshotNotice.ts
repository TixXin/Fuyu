import { useState, type PointerEvent } from "react";
import { Menu } from "@tauri-apps/api/menu";
import { focusAgentWindow, type AgentSessionSummary } from "../agent-status/api";
import { addFileShelfPaths } from "../file-shelf/api";
import { useErrorText, useTranslation } from "../../i18n";
import { dragScreenshot, pasteScreenshotToFront, type ScreenshotTaken } from "./api";
import type { ScreenshotCardState } from "./useScreenshotCard";

function sessionName(session: AgentSessionSummary) {
  const folder = session.cwd?.split(/[\\/]/).filter(Boolean).pop();
  return session.title?.trim() || folder || session.provider;
}

export function useScreenshotNotice(card: ScreenshotCardState, sessions: readonly AgentSessionSummary[]) {
  const t = useTranslation().screenshot;
  const errorText = useErrorText();
  const [message, setMessage] = useState<{ path: string; text: string } | null>(null);
  const taken: ScreenshotTaken | null = card.current;
  const local = sessions.filter((session) => !session.remoteHost);
  const report = (error: unknown) => taken && setMessage({ path: taken.path, text: errorText(error) });

  const send = async (session: AgentSessionSummary) => {
    if (!taken) return;
    const found = await focusAgentWindow(session.provider, session.cwd, session.title, session.sessionId);
    if (!found) {
      setMessage({ path: taken.path, text: t.card.agentNotFound });
      return;
    }
    await pasteScreenshotToFront(taken.path);
    card.dismiss();
  };

  const sendToAgent = async () => {
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

  const shelve = () => {
    if (!taken) return;
    addFileShelfPaths([taken.path]).then(() => setMessage({ path: taken.path, text: t.card.shelved }), report);
  };

  const drag = (event: PointerEvent) => {
    if (!taken || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragScreenshot(taken.path).then(() => card.dismiss(), report);
  };

  const text = taken && message?.path === taken.path ? message.text : taken?.saved ? t.card.saved : t.card.copied;
  return { taken, text, canSend: local.length > 0, sendToAgent, shelve, drag, card };
}

export type ScreenshotNoticeState = ReturnType<typeof useScreenshotNotice>;
