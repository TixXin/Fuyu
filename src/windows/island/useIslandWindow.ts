import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS } from "../../lib/settings/settings";
import { STORAGE_KEY, readSettingsText } from "../../lib/settings/storage";
import type { IslandSettings } from "../../lib/settings/types";
import { isMacOS } from "../../lib/platform";
import { useIslandLayerShortcut } from "../../lib/island-layer/useIslandLayerShortcut";
import * as islandApi from "./api";
import { islandMarginY } from "./islandForm";
import { clearIslandPosition } from "./storage";
import type { IslandMode, NativeGlassState } from "./types";
import { useClickFocus } from "./useClickFocus";
import { useCollapseOnBlur } from "./useCollapseOnBlur";
import { useIslandPosition } from "./useIslandPosition";
import { readIslandGlassFrame } from "./useNativeGlassSync";
import { useNativeLayout } from "./useNativeLayout";
import { useSettingsPositionReset } from "./useSettingsPositionReset";
import { createExternalResizeTracker, createSingleFlightFrameQueue } from "./windowSync";

const SHOW_RETRY_DELAYS_MS = [0, 300, 1000, 3000];
const SYNC_WAIT_BEFORE_SHOW_MS = 200;
const RESIZING_CLASS = "island-resizing";

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

type InteractionSnapshot = {
  mode: IslandMode;
  settings: IslandSettings;
  expandedHeight: number;
  expandedWidth: number;
  collapsedWidth: number;
  isTucked: boolean;
  isDimmed: boolean;
  gamePassthrough: boolean;
  backgroundColor?: string;
};

type IslandWindowOptions = {
  mode: IslandMode;
  isTucked: boolean;
  isDimmed?: boolean;
  gamePassthrough?: boolean;
  settings: IslandSettings;
  setSettings: (settings: IslandSettings) => void;
  backgroundColor?: string;
  expandedIslandHeight: number;
  expandedIslandWidth: number;
  collapsedIslandWidth: number;
  ready: boolean;
  onCollapse: () => void;
};

export function useIslandWindow({
  mode,
  isTucked,
  isDimmed = false,
  gamePassthrough = false,
  settings,
  setSettings,
  backgroundColor,
  expandedIslandHeight,
  expandedIslandWidth,
  collapsedIslandWidth,
  ready,
  onCollapse,
}: IslandWindowOptions) {
  const syncNativeLayout = useNativeLayout(settings);
  useIslandLayerShortcut(settings.islandLayerShortcut);
  const { isPositionDetached, setIsPositionDetached, islandPositionRef, startIslandDrag } = useIslandPosition();
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [nativeGlassState, setNativeGlassState] = useState<NativeGlassState>("disabled");
  const didShowInitialWindow = useRef(false);

  const syncNativeInteraction = useCallback(
    async ({
      mode: nextMode,
      settings: nextSettings,
      expandedHeight,
      expandedWidth,
      collapsedWidth,
      isTucked: nextIsTucked,
      isDimmed: nextIsDimmed,
      gamePassthrough: nextGamePassthrough,
      backgroundColor: nextBackgroundColor,
    }: InteractionSnapshot) => {
      const glassEnabled = nextSettings.appearanceMode === "liquidGlass";
      try {
        const glassFrame = isMacOS && glassEnabled && nextSettings.glassBackdrop === "native"
          ? readIslandGlassFrame(false)
          : null;
        const glassState = await islandApi.setIslandInteraction({
          mode: nextMode,
          collapsedScale: nextSettings.collapsedScale,
          expandedScale: nextSettings.expandedScale,
          marginY: islandMarginY(nextSettings),
          expandedHeight,
          expandedWidth,
          collapsedWidth,
          customPosition: islandPositionRef.current,
          isTucked: nextIsTucked,
          isDimmed: nextIsDimmed,
          animatePosition: !reducedMotion,
          glassEnabled,
          glassIntensity: nextSettings.glassIntensity,
          glassTint: nextBackgroundColor ?? nextSettings.islandBackgroundColor,
          glassBackdrop: nextSettings.glassBackdrop,
          topFilletRadius: nextSettings.topFilletRadius,
          glassFrame,
          cornerRadius: nextSettings.islandCornerRadius,
          cornerShape: nextSettings.islandCornerShape,
          monitorFollow: nextSettings.islandMonitor,
          tuckStyle: nextSettings.tuckStyle,
          gamePassthrough: nextGamePassthrough,
        });
        setNativeGlassState(glassState);
      } catch (error) {
        console.error("Failed to sync island interaction", error);
        setNativeGlassState(glassEnabled ? "css-fallback" : "disabled");
      }
    },
    [islandPositionRef, reducedMotion],
  );

  const latestSyncRef = useRef(syncNativeInteraction);
  latestSyncRef.current = syncNativeInteraction;
  const queueRef = useRef<ReturnType<typeof createSingleFlightFrameQueue<InteractionSnapshot>> | null>(null);
  if (queueRef.current === null) {
    queueRef.current = createSingleFlightFrameQueue((item) => latestSyncRef.current(item));
  }

  const showReadyIsland = useCallback(async () => {
    if (didShowInitialWindow.current) return;
    didShowInitialWindow.current = true;
    for (const delay of SHOW_RETRY_DELAYS_MS) {
      if (delay > 0) await wait(delay);
      try {
        await islandApi.showReadyIsland();
        return;
      } catch (error) {
        console.error("Failed to show island", error);
      }
    }
    didShowInitialWindow.current = false;
  }, []);

  const minimizeIsland = useCallback(async () => {
    try {
      await islandApi.minimizeIsland();
    } catch (error) {
      console.error("Failed to minimize island", error);
    }
  }, []);

  const resetIslandPosition = useCallback(async () => {
    try {
      const nextSettings = { ...settings, marginY: DEFAULT_SETTINGS.marginY };
      await syncNativeLayout(nextSettings);
      await islandApi.resetIslandPosition();
      islandPositionRef.current = null;
      setIsPositionDetached(false);
      clearIslandPosition();
      setSettings(nextSettings);
    } catch (error) {
      console.error("Failed to reset island position", error);
    }
  }, [islandPositionRef, setIsPositionDetached, setSettings, settings, syncNativeLayout]);
  useSettingsPositionReset(resetIslandPosition);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateReducedMotion = () => setReducedMotion(query.matches);
    query.addEventListener("change", updateReducedMotion);
    return () => query.removeEventListener("change", updateReducedMotion);
  }, []);

  const externalSeenRef = useRef(false);
  const resizeTrackerRef = useRef<ReturnType<typeof createExternalResizeTracker> | null>(null);
  useEffect(() => {
    const tracker = createExternalResizeTracker(settings, {
      setResizing: (active) => {
        if (active) {
          document.documentElement.classList.add(RESIZING_CLASS);
        } else if (!document.documentElement.dataset.islandDrag) {
          document.documentElement.classList.remove(RESIZING_CLASS);
        }
      },
    });
    resizeTrackerRef.current = tracker;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_KEY) return;
      externalSeenRef.current = true;
      queueMicrotask(() => {
        externalSeenRef.current = false;
      });
      tracker.onStorageValue(event.newValue ?? readSettingsText(), performance.now());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      tracker.dispose();
      resizeTrackerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!externalSeenRef.current) {
      resizeTrackerRef.current?.syncLocal(settings);
    }
  }, [settings]);

  useEffect(() => () => queueRef.current?.dispose(), []);

  const marginY = islandMarginY(settings);
  const glassEnabled = settings.appearanceMode === "liquidGlass";
  const nativeGlassBackdrop = isMacOS && glassEnabled ? settings.glassBackdrop : undefined;
  const nativeGlassActive = nativeGlassBackdrop === "native";
  const nativeGlassIntensity = nativeGlassActive ? settings.glassIntensity : undefined;
  const nativeGlassTint = nativeGlassActive ? (backgroundColor ?? settings.islandBackgroundColor) : undefined;
  const nativeTopFilletRadius = nativeGlassActive ? settings.topFilletRadius : undefined;

  useEffect(() => {
    if (!ready || !queueRef.current) return;
    const synced = queueRef.current.schedule({
      mode,
      settings,
      expandedHeight: expandedIslandHeight,
      expandedWidth: expandedIslandWidth,
      collapsedWidth: collapsedIslandWidth,
      isTucked,
      isDimmed,
      gamePassthrough,
      backgroundColor,
    });
    if (!didShowInitialWindow.current) {
      void Promise.race([synced, wait(SYNC_WAIT_BEFORE_SHOW_MS)]).finally(() => {
        void showReadyIsland();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    expandedIslandHeight,
    expandedIslandWidth,
    collapsedIslandWidth,
    isTucked,
    isDimmed,
    gamePassthrough,
    mode,
    marginY,
    glassEnabled,
    nativeGlassBackdrop,
    nativeGlassIntensity,
    nativeGlassTint,
    nativeTopFilletRadius,
    settings.collapsedScale,
    settings.expandedScale,
    settings.islandCornerRadius,
    settings.islandCornerShape,
    settings.islandMonitor,
    settings.tuckStyle,
    reducedMotion,
    showReadyIsland,
  ]);

  useClickFocus(mode === "expanded");
  useCollapseOnBlur(mode === "expanded", onCollapse);

  return { isPositionDetached, nativeGlassState, minimizeIsland, startIslandDrag, resetIslandPosition };
}
