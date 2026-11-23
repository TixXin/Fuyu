import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import { getForegroundFullscreen, listenAgentNotificationOpened, listenForegroundFullscreen, notifyAgent, type AgentSessionSummary } from "./api";
import { freshAlerts, islandHiddenByFullscreen, phasesOf, type FullscreenAlertSettings, type FullscreenView } from "./fullscreenAlerts";
import { sessionName } from "./session";

const NOT_FULLSCREEN: FullscreenView = { active: false, onIslandMonitor: false };

function useFullscreen(watching: boolean) {
  const [view, setView] = useState<FullscreenView>(NOT_FULLSCREEN);
  useEffect(() => {
    if (!watching) {
      setView(NOT_FULLSCREEN);
      return;
    }
    let cancelled = false;
    const stop = listenForegroundFullscreen(setView);
    void getForegroundFullscreen().then((next) => { if (!cancelled) setView(next); }).catch(() => undefined);
    return () => {
      cancelled = true;
      void stop.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, [watching]);
  return view;
}

export function useFullscreenAgentAlerts(enabled: boolean, sessions: readonly AgentSessionSummary[], settings: FullscreenAlertSettings, onOpen: () => void) {
  const t = useTranslation();
  const view = useFullscreen(enabled && settings.gameAutoTuck && !settings.gameDoNotDisturb);
  const hidden = enabled && islandHiddenByFullscreen(view, settings);
  const seen = useRef<ReadonlyMap<string, string> | null>(null);

  useEffect(() => {
    if (!hidden) {
      seen.current = null;
      return;
    }
    const before = seen.current;
    seen.current = phasesOf(sessions);
    if (!before) return;
    for (const { tag, phase, session } of freshAlerts(before, sessions)) {
      const { label, title } = sessionName(session);
      const heading = phase === "waiting" ? t.island.agentNeedsYou(label) : t.island.agentFailed(label);
      void notifyAgent(tag, heading, title).catch(() => undefined);
    }
  }, [hidden, sessions, t]);

  const openRef = useRef(onOpen);
  useEffect(() => {
    openRef.current = onOpen;
  });
  useEffect(() => {
    if (!enabled) return;
    const stop = listenAgentNotificationOpened(() => openRef.current());
    return () => void stop.then((unlisten) => unlisten()).catch(() => undefined);
  }, [enabled]);
}
