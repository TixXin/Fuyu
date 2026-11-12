import { useEffect, useRef } from "react";
import type { AgentSessionSummary } from "../../features/agent-status/api";
import { getUserIdleSeconds, isSessionLocked } from "../../features/agent-status/push/api";
import {
  downloadInBackground, getUpdateState, installUpdate, subscribeToUpdate,
} from "../../features/updater/updaterController";
import { getForegroundFullscreen } from "./api";
import type { IslandMode } from "./types";

const IDLE_SECONDS = 10 * 60;
const IDLE_CHECK_MS = 30_000;

export function useIslandAutoUpdate({ mode, sessions }: { mode: IslandMode; sessions: AgentSessionSummary[] }) {
  const latest = useRef({ mode, sessions });
  latest.current = { mode, sessions };

  useEffect(() => {
    const download = () => {
      if (getUpdateState().stage === "available") void downloadInBackground();
    };
    download();
    return subscribeToUpdate(download);
  }, []);

  useEffect(() => {
    let running = false;
    const tryInstall = async () => {
      const state = getUpdateState();
      if (running || state.stage !== "ready" || state.autoUpdate !== "install" || state.nextVersion === state.skippedVersion) return;
      const { mode: islandMode, sessions: agentSessions } = latest.current;
      if (islandMode === "expanded" || agentSessions.some((session) => session.phase === "running" || session.phase === "waiting")) return;
      running = true;
      try {
        const [locked, idle] = await Promise.all([isSessionLocked().catch(() => false), getUserIdleSeconds().catch(() => null)]);
        if (!locked && (idle === null || idle < IDLE_SECONDS)) return;
        const fullscreen = await getForegroundFullscreen().catch(() => ({ active: true, onIslandMonitor: true }));
        if (fullscreen.active) return;
        await installUpdate(state.nextVersion, state.channel);
      } finally {
        running = false;
      }
    };
    const timer = window.setInterval(() => void tryInstall(), IDLE_CHECK_MS);
    return () => window.clearInterval(timer);
  }, []);
}
