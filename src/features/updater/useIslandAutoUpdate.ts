import { useEffect, useRef } from "react";
import { getUserIdleSeconds, isSessionLocked } from "../../lib/api";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import {
  downloadInBackground, getUpdateState, installUpdate, subscribeToUpdate,
} from "./updaterController";
import { getForegroundFullscreen } from "./api";

const IDLE_SECONDS = 10 * 60;
const IDLE_CHECK_MS = 30_000;

export function useIslandAutoUpdate({ mode, agentsBusy }: { mode: string; agentsBusy: boolean }) {
  const latest = useRef({ mode, agentsBusy });
  latest.current = { mode, agentsBusy };

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
      if (state.backupFailed === state.nextVersion) return;
      const { mode: islandMode, agentsBusy: busy } = latest.current;
      if (islandMode === "expanded" || busy) return;
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
    return visibilityInterval(() => void tryInstall(), IDLE_CHECK_MS);
  }, []);
}
