import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../../lib/theme/useReducedMotion";
import type { IslandPage } from "../island/types";
import { sendIslandDirectorCommand } from "./storage";

export const DIRECTOR_SCENE_IDS = ["greet", "dashboard", "agents", "music", "tuck", "collapse"] as const;
export type DirectorSceneId = (typeof DIRECTOR_SCENE_IDS)[number];
export type DirectorStatus = "playing" | "paused" | "user";

type SceneDef = {
  id: DirectorSceneId;
  durationMs: number;
};

const SCENES: readonly SceneDef[] = [
  { id: "greet", durationMs: 2600 },
  { id: "dashboard", durationMs: 3200 },
  { id: "agents", durationMs: 3200 },
  { id: "music", durationMs: 3000 },
  { id: "tuck", durationMs: 2400 },
  { id: "collapse", durationMs: 2200 },
];

export function useOnboardingDirector({
  autoPlay,
  notifyTitle,
  notifyBody,
}: {
  autoPlay: boolean;
  notifyTitle: string;
  notifyBody: string;
}) {
  const reducedMotion = useReducedMotion();
  const [status, setStatus] = useState<DirectorStatus>("paused");
  const [sceneIndex, setSceneIndex] = useState<number>(0);
  const timerRef = useRef<number>(0);
  const previewTimerRef = useRef<number>(0);
  const playingRef = useRef(false);

  const clearTimers = useCallback(() => {
    window.clearTimeout(timerRef.current);
    window.clearTimeout(previewTimerRef.current);
    timerRef.current = 0;
    previewTimerRef.current = 0;
  }, []);

  const dispatchScene = useCallback(
    (id: DirectorSceneId) => {
      if (id === "greet") {
        sendIslandDirectorCommand({ action: "reveal" });
        sendIslandDirectorCommand({ action: "collapse" });
        sendIslandDirectorCommand({ action: "notify", title: notifyTitle, body: notifyBody });
      } else if (id === "dashboard") {
        sendIslandDirectorCommand({ action: "expand", page: "fuyu" });
      } else if (id === "agents") {
        sendIslandDirectorCommand({ action: "expand", page: "agents" });
      } else if (id === "music") {
        sendIslandDirectorCommand({ action: "expand", page: "music" });
      } else if (id === "tuck") {
        sendIslandDirectorCommand({ action: "tuck" });
      } else {
        sendIslandDirectorCommand({ action: "reveal" });
        sendIslandDirectorCommand({ action: "collapse" });
      }
    },
    [notifyBody, notifyTitle],
  );

  const startFrom = useCallback(
    (startIndex: number) => {
      clearTimers();
      if (reducedMotion) {
        playingRef.current = false;
        setStatus("paused");
        return;
      }
      playingRef.current = true;
      setStatus("playing");
      const run = (at: number) => {
        if (!playingRef.current || document.hidden) return;
        const idx = at % SCENES.length;
        const scene = SCENES[idx];
        setSceneIndex(idx);
        dispatchScene(scene.id);
        timerRef.current = window.setTimeout(() => run(idx + 1), scene.durationMs);
      };
      run(startIndex);
    },
    [clearTimers, dispatchScene, reducedMotion],
  );

  const pause = useCallback(
    (reason: "paused" | "user" = "paused") => {
      clearTimers();
      playingRef.current = false;
      setStatus(reason);
    },
    [clearTimers],
  );

  const selectScene = useCallback(
    (id: DirectorSceneId) => {
      const idx = SCENES.findIndex((item) => item.id === id);
      if (idx === -1) return;
      if (reducedMotion) {
        setSceneIndex(idx);
        dispatchScene(id);
        return;
      }
      startFrom(idx);
    },
    [dispatchScene, reducedMotion, startFrom],
  );

  const nextScene = useCallback(() => {
    const next = (sceneIndex + 1) % SCENES.length;
    if (reducedMotion) {
      setSceneIndex(next);
      dispatchScene(SCENES[next].id);
      return;
    }
    startFrom(next);
  }, [dispatchScene, reducedMotion, sceneIndex, startFrom]);

  const togglePlay = useCallback(() => {
    if (status === "playing") pause("paused");
    else startFrom(sceneIndex);
  }, [pause, sceneIndex, startFrom, status]);

  const previewMotion = useCallback(() => {
    pause("paused");
    sendIslandDirectorCommand({ action: "expand", page: "fuyu" });
    previewTimerRef.current = window.setTimeout(() => {
      sendIslandDirectorCommand({ action: "expand", page: "agents" });
      previewTimerRef.current = window.setTimeout(() => {
        sendIslandDirectorCommand({ action: "collapse" });
      }, 900);
    }, 650);
  }, [pause]);

  const previewPage = useCallback(
    (page: IslandPage) => {
      pause("user");
      sendIslandDirectorCommand({ action: "expand", page });
    },
    [pause],
  );

  useEffect(() => {
    if (autoPlay && !reducedMotion) {
      startFrom(0);
    } else {
      pause("paused");
    }
    return clearTimers;
  }, [autoPlay, clearTimers, pause, reducedMotion, startFrom]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && playingRef.current) pause("paused");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pause]);

  return {
    status,
    activeScene: status === "playing" ? SCENES[sceneIndex].id : null,
    currentScene: SCENES[sceneIndex].id,
    togglePlay,
    nextScene,
    selectScene,
    pause,
    previewMotion,
    previewPage,
  };
}
