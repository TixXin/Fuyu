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
  expanded: boolean;
};

const SCENES: readonly SceneDef[] = [
  { id: "greet", durationMs: 2600, expanded: false },
  { id: "dashboard", durationMs: 3200, expanded: true },
  { id: "agents", durationMs: 3200, expanded: true },
  { id: "music", durationMs: 3000, expanded: true },
  { id: "tuck", durationMs: 2400, expanded: false },
  { id: "collapse", durationMs: 2200, expanded: false },
];

const USER_OVERRIDE_GRACE_MS = 750;

export function useOnboardingDirector({
  autoPlay,
  islandExpanded,
  stepId,
  notifyTitle,
  notifyBody,
}: {
  autoPlay: boolean;
  islandExpanded: boolean | null;
  stepId: string;
  notifyTitle: string;
  notifyBody: string;
}) {
  const reducedMotion = useReducedMotion();
  const [status, setStatus] = useState<DirectorStatus>("paused");
  const [sceneIndex, setSceneIndex] = useState<number>(0);
  const timerRef = useRef<number>(0);
  const previewTimerRef = useRef<number>(0);
  const playingRef = useRef(false);
  const expectedExpandedRef = useRef<boolean | null>(null);
  const lastCommandAtRef = useRef(0);
  const prevStepRef = useRef(stepId);

  const clearTimers = useCallback(() => {
    window.clearTimeout(timerRef.current);
    window.clearTimeout(previewTimerRef.current);
    timerRef.current = 0;
    previewTimerRef.current = 0;
  }, []);

  const dispatchScene = useCallback(
    (scene: SceneDef) => {
      expectedExpandedRef.current = scene.expanded;
      lastCommandAtRef.current = Date.now();
      if (scene.id === "greet") {
        sendIslandDirectorCommand({ action: "notify", title: notifyTitle, body: notifyBody });
      } else if (scene.id === "dashboard") {
        sendIslandDirectorCommand({ action: "expand", page: "fuyu" });
      } else if (scene.id === "agents") {
        sendIslandDirectorCommand({ action: "expand", page: "agents" });
      } else if (scene.id === "music") {
        sendIslandDirectorCommand({ action: "expand", page: "music" });
      } else if (scene.id === "tuck") {
        sendIslandDirectorCommand({ action: "tuck" });
      } else {
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
        dispatchScene(scene);
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
      expectedExpandedRef.current = null;
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
        dispatchScene(SCENES[idx]);
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
      dispatchScene(SCENES[next]);
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
    if (prevStepRef.current !== stepId) {
      const prev = prevStepRef.current;
      prevStepRef.current = stepId;
      if (prev === "hello" || stepId === "shape" || stepId === "play") {
        sendIslandDirectorCommand({ action: "collapse" });
      }
    }
  }, [stepId]);

  useEffect(() => {
    if (!playingRef.current || islandExpanded === null || expectedExpandedRef.current === null) return;
    if (Date.now() - lastCommandAtRef.current < USER_OVERRIDE_GRACE_MS) return;
    if (islandExpanded !== expectedExpandedRef.current) {
      pause("user");
    }
  }, [islandExpanded, pause]);

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
