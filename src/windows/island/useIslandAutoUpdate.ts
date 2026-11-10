import { useEffect, useRef } from "react";
import type { AgentSessionSummary } from "../../features/agent-status/api";
import { getUserIdleSeconds, isSessionLocked } from "../../features/agent-status/push/api";
import {
  downloadInBackground, getUpdateState, installUpdate, subscribeToUpdate,
} from "../../features/updater/updaterController";
import { getForegroundFullscreen } from "./api";
import type { IslandMode } from "./types";

/** Without input this long (or with the screen locked), the computer counts as idle. */
const IDLE_SECONDS = 10 * 60;
const IDLE_CHECK_MS = 30_000;

/**
 * Automatic updates (task D18), in the main window only: a found update downloads in the
 * background, and with "install when idle" it installs once nobody would notice the island
 * restart: the screen locked or no input for 10 minutes, the island not open, no agent running
 * or waiting on the user (its approval port and alerts go away while the island restarts), and
 * no full-screen app in front.
 */
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
