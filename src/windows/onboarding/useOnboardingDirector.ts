import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PreviewSamples } from "../../features/agent-status/reminder-settings/previewSamples";
import type { IslandDockEdge } from "../../lib/settings/api";
import type { IslandForm } from "../../lib/settings/types";
import { useReducedMotion } from "../../lib/theme/useReducedMotion";
import type { IslandPage } from "../island/types";
import {
  restoreSavedAnchor,
  runDirectorScene,
  type DirectorDispatchEnv,
  type DirectorDispatchState,
} from "./directorDispatch";
import {
  resolveDirectorScenes,
  type DirectorSceneDef,
  type DirectorSceneGroup,
  type DirectorSceneId,
} from "./directorScenes";
import { sendIslandDirectorCommand } from "./storage";

export { DIRECTOR_SCENE_GROUPS, DIRECTOR_SCENE_IDS } from "./directorScenes";
export type { DirectorSceneDef, DirectorSceneGroup, DirectorSceneId } from "./directorScenes";

export type DirectorStatus = "playing" | "paused" | "user";

const USER_OVERRIDE_GRACE_MS = 750;

export function useOnboardingDirector({
  autoPlay,
  skipInitialNotify = false,
  islandExpanded,
  stepId,
  islandForm,
  edge,
  taskbarAvailable,
  taskbarDocked,
  agentsEnabled,
  onSetIslandForm,
  notifyTitle,
  notifyBody,
  agentSamples,
}: {
  autoPlay: boolean;
  skipInitialNotify?: boolean;
  islandExpanded: boolean | null;
  stepId: string;
  islandForm: IslandForm;
  edge: IslandDockEdge | null;
  taskbarAvailable: boolean;
  taskbarDocked: boolean;
  agentsEnabled: boolean;
  onSetIslandForm: (form: IslandForm) => void;
  notifyTitle: string;
  notifyBody: string;
  agentSamples: PreviewSamples;
}) {
  const reducedMotion = useReducedMotion();
  const scenes = useMemo(
    () => resolveDirectorScenes({ agentsEnabled, taskbarAvailable }),
    [agentsEnabled, taskbarAvailable],
  );
  const [status, setStatus] = useState<DirectorStatus>("paused");
  const [sceneIndex, setSceneIndex] = useState<number>(0);
  const [runToken, setRunToken] = useState<number>(0);
  const [anchorDirty, setAnchorDirty] = useState<boolean>(false);
  const [wingsPreview, setWingsPreview] = useState<boolean>(false);

  const timerRef = useRef<number>(0);
  const previewTimerRef = useRef<number>(0);
  const playingRef = useRef(false);
  const prevStepRef = useRef(stepId);
  const dispatchRef = useRef<DirectorDispatchState>({
    prepTimer: 0,
    expectedExpanded: null,
    lastCommandAt: 0,
    lastKind: "collapsed",
    virtualDocked: false,
    savedAnchor: null,
    savedSideDocks: null,
    wingsPreviewOpen: false,
    noticeSeq: 0,
  });
  const initialGreetingRef = useRef(skipInitialNotify);

  const envRef = useRef<DirectorDispatchEnv & { scenes: DirectorSceneDef[] }>({
    scenes,
    islandForm,
    edge,
    taskbarDocked,
    onSetIslandForm,
    notifyTitle,
    notifyBody,
    agentSamples,
  });
  useLayoutEffect(() => {
    envRef.current = {
      scenes,
      islandForm,
      edge,
      taskbarDocked,
      onSetIslandForm,
      notifyTitle,
      notifyBody,
      agentSamples,
    };
  });

  const clearTimers = useCallback(() => {
    window.clearTimeout(timerRef.current);
    window.clearTimeout(dispatchRef.current.prepTimer);
    window.clearTimeout(previewTimerRef.current);
    timerRef.current = 0;
    dispatchRef.current.prepTimer = 0;
    previewTimerRef.current = 0;
  }, []);

  const restoreAnchor = useCallback((clearOnly = false) => {
    if (restoreSavedAnchor(dispatchRef.current, envRef.current, clearOnly)) {
      setAnchorDirty(false);
    }
  }, []);

  const dispatchScene = useCallback((scene: DirectorSceneDef, fromAutoStart = false) => {
    setRunToken((n) => n + 1);
    const skipNotify = fromAutoStart && scene.id === "greet" && initialGreetingRef.current;
    if (skipNotify) initialGreetingRef.current = false;
    runDirectorScene(scene, dispatchRef.current, () => envRef.current, () => setAnchorDirty(true), { skipNotify });
  }, []);

  const startFrom = useCallback(
    (startIndex: number, fromAutoStart = false) => {
      clearTimers();
      if (reducedMotion) {
        playingRef.current = false;
        setStatus("paused");
        return;
      }
      playingRef.current = true;
      setStatus("playing");
      const run = (at: number, initial: boolean) => {
        if (!playingRef.current || document.hidden) return;
        const list = envRef.current.scenes;
        if (list.length === 0) return;
        const idx = ((at % list.length) + list.length) % list.length;
        const scene = list[idx];
        setSceneIndex(idx);
        dispatchScene(scene, initial);
        timerRef.current = window.setTimeout(() => run(idx + 1, false), scene.durationMs);
      };
      run(startIndex, fromAutoStart);
    },
    [clearTimers, dispatchScene, reducedMotion],
  );

  const pause = useCallback(
    (reason: "paused" | "user" = "paused") => {
      clearTimers();
      playingRef.current = false;
      dispatchRef.current.expectedExpanded = null;
      setStatus(reason);
    },
    [clearTimers],
  );

  const claimUserControl = useCallback(() => {
    restoreAnchor(true);
    pause("user");
  }, [pause, restoreAnchor]);

  const jumpTo = useCallback(
    (idx: number) => {
      const list = envRef.current.scenes;
      if (idx < 0 || idx >= list.length) return;
      if (reducedMotion) {
        setSceneIndex(idx);
        dispatchScene(list[idx]);
        return;
      }
      startFrom(idx);
    },
    [dispatchScene, reducedMotion, startFrom],
  );

  const selectScene = useCallback(
    (id: DirectorSceneId) => jumpTo(envRef.current.scenes.findIndex((item) => item.id === id)),
    [jumpTo],
  );

  const playGroup = useCallback(
    (group: DirectorSceneGroup) => jumpTo(envRef.current.scenes.findIndex((item) => item.group === group)),
    [jumpTo],
  );

  const nextScene = useCallback(() => {
    const len = envRef.current.scenes.length;
    if (len > 0) jumpTo((sceneIndex + 1) % len);
  }, [jumpTo, sceneIndex]);

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
      dispatchRef.current.lastKind = "expanded";
      sendIslandDirectorCommand({ action: "expand", page });
    },
    [pause],
  );

  const collapsePreview = useCallback(() => {
    dispatchRef.current.lastKind = "collapsed";
    sendIslandDirectorCommand({ action: "collapse" });
  }, []);

  useEffect(() => {
    if (prevStepRef.current !== stepId) {
      const prev = prevStepRef.current;
      prevStepRef.current = stepId;
      setWingsPreview(false);
      if (prev === "hello") {
        restoreAnchor(false);
        dispatchRef.current.lastKind = "collapsed";
        sendIslandDirectorCommand({ action: "collapse" });
      } else if (stepId === "shape" || stepId === "play") {
        dispatchRef.current.lastKind = "collapsed";
        sendIslandDirectorCommand({ action: "collapse" });
      }
    }
  }, [restoreAnchor, stepId]);

  useEffect(() => {
    const state = dispatchRef.current;
    if (!playingRef.current || islandExpanded === null || state.expectedExpanded === null) return;
    if (Date.now() - state.lastCommandAt < USER_OVERRIDE_GRACE_MS) return;
    if (islandExpanded !== state.expectedExpanded) pause("user");
  }, [islandExpanded, pause]);

  useEffect(() => {
    if (autoPlay && !reducedMotion) startFrom(0, true);
    else pause("paused");
    return clearTimers;
  }, [autoPlay, clearTimers, pause, reducedMotion, startFrom]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && playingRef.current) pause("paused");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pause]);

  const safeIndex = Math.min(sceneIndex, Math.max(0, scenes.length - 1));
  const current = scenes[safeIndex] ?? scenes[0];
  const showingSideWings = wingsPreview || Boolean(current.mutatesSideDocks && status === "playing");

  return {
    status,
    scenes,
    sceneIndex: safeIndex,
    sceneCount: scenes.length,
    runToken,
    anchorDirty,
    showingSideWings,
    setWingsPreview,
    activeScene: status === "playing" ? current.id : null,
    currentScene: current.id,
    currentDurationMs: current.durationMs,
    togglePlay,
    nextScene,
    selectScene,
    playGroup,
    pause,
    claimUserControl,
    restoreAnchor: () => restoreAnchor(false),
    previewMotion,
    previewPage,
    collapsePreview,
  };
}
