import { agentsV1, fileShelfV1, type AgentSessionEntry } from "@fuyu/plugin-services";
import { useEffect, useState, type PointerEvent } from "react";
import { Menu } from "@tauri-apps/api/menu";
import { useErrorText, useTranslation } from "../../i18n";
import { windowServices } from "../plugin-kernel/services";
import { dragScreenshot, pasteScreenshotToFront, type ScreenshotTaken } from "./api";
import { serviceFailed } from "./serviceErrors";
import type { ScreenshotCardState } from "./useScreenshotCard";

const agents = windowServices.get(agentsV1);
const shelf = windowServices.get(fileShelfV1);
const NO_SESSIONS: readonly AgentSessionEntry[] = [];

function sessionName(session: AgentSessionEntry) {
  const folder = session.cwd?.split(/[\\/]/).filter(Boolean).pop();
  return session.title?.trim() || folder || session.provider;
}

function focusParams(session: AgentSessionEntry) {
  return {
    provider: session.provider,
    ...(session.sessionId ? { sessionId: session.sessionId } : {}),
    ...(session.cwd ? { cwd: session.cwd } : {}),
    ...(session.title ? { title: session.title } : {}),
  };
}

function useLocalSessions(watching: boolean) {
  const [sessions, setSessions] = useState(NO_SESSIONS);
  useEffect(() => {
    if (!watching) return;
    let live = true;
    let asked = 0;
    const load = () => {
      const ask = ++asked;
      agents.sessions().then(
        (answer) => live && ask === asked && setSessions(answer.sessions.filter((session) => session.listed && !session.remoteHost)),
        () => live && ask === asked && setSessions(NO_SESSIONS),
      );
    };
    load();
    const off = agents.on("changed", load);
    const unwatch = windowServices.watch(load);
    return () => {
      live = false;
      void off();
      unwatch();
    };
  }, [watching]);
  return watching ? sessions : NO_SESSIONS;
}

export function useScreenshotNotice(card: ScreenshotCardState) {
  const t = useTranslation().screenshot;
  const errorText = useErrorText();
  const [message, setMessage] = useState<{ path: string; text: string } | null>(null);
  const taken: ScreenshotTaken | null = card.current;
  const local = useLocalSessions(taken !== null);
  const report = (error: unknown) => taken && setMessage({ path: taken.path, text: errorText(error) });

  const send = async (session: AgentSessionEntry) => {
    if (!taken) return;
    const { found } = await agents.focus(focusParams(session));
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
    shelf.add({ paths: [taken.path] }).then(
      () => setMessage({ path: taken.path, text: t.card.shelved }),
      (error: unknown) => setMessage({ path: taken.path, text: serviceFailed(error, t.shelfOff, errorText) }),
    );
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
