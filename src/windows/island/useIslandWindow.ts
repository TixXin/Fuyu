import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS } from "../../features/appearance/settings";
import type { IslandSettings } from "../../features/appearance/types";
import * as islandApi from "./api";
import { clearIslandPosition } from "./storage";
import { useIslandPosition } from "./useIslandPosition";
import { useNativeLayout } from "./useNativeLayout";
import { islandMarginY } from "./islandForm";
import { useSettingsPositionReset } from "./useSettingsPositionReset";
import { useClickFocus } from "./useClickFocus";
import { useCollapseOnBlur } from "./useCollapseOnBlur";
import type { IslandMode, NativeGlassState } from "./types";

const SHOW_RETRY_DELAYS_MS = [0, 300, 1000, 3000];
const SYNC_WAIT_BEFORE_SHOW_MS = 1500;

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

type IslandWindowOptions = {
  mode: IslandMode;
  isTucked: boolean;
  settings: IslandSettings;
  setSettings: (settings: IslandSettings) => void;
  expandedIslandHeight: number;
  expandedIslandWidth: number;
  collapsedIslandWidth: number;
  onCollapse: () => void;
};

export function useIslandWindow({
  mode,
  isTucked,
  settings,
  setSettings,
  expandedIslandHeight,
  expandedIslandWidth,
  collapsedIslandWidth,
  onCollapse,
}: IslandWindowOptions) {
  const syncNativeLayout = useNativeLayout(settings);
  const { isPositionDetached, setIsPositionDetached, islandPositionRef, startIslandDrag } = useIslandPosition();
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [nativeGlassState, setNativeGlassState] =
    useState<NativeGlassState>("disabled");
  const didShowInitialWindow = useRef(false);
  const syncNativeInteraction = useCallback(
    async (
      nextMode: IslandMode,
      nextSettings: IslandSettings,
      nextExpandedHeight: number,
      nextExpandedWidth: number,
      nextCollapsedWidth: number,
      nextIsTucked: boolean,
    ) => {
      try {
        const glassState = await islandApi.setIslandInteraction({
          mode: nextMode,
          collapsedScale: nextSettings.collapsedScale,
          expandedScale: nextSettings.expandedScale,
          marginY: islandMarginY(nextSettings),
          expandedHeight: nextExpandedHeight,
          expandedWidth: nextExpandedWidth,
          collapsedWidth: nextCollapsedWidth,
          customPosition: islandPositionRef.current,
          isTucked: nextIsTucked,
          animatePosition: !reducedMotion,
          glassEnabled: nextSettings.appearanceMode === "liquidGlass",
          glassIntensity: nextSettings.glassIntensity,
          glassTint: nextSettings.islandBackgroundColor,
          cornerRadius: nextSettings.islandCornerRadius,
          cornerShape: nextSettings.islandCornerShape,
          monitorFollow: nextSettings.islandMonitor,
        });
        setNativeGlassState(glassState);
      } catch (error) {
        console.error("Failed to sync island interaction", error);
        setNativeGlassState(
          nextSettings.appearanceMode === "liquidGlass"
            ? "css-fallback"
            : "disabled",
        );
      }
    },
    [islandPositionRef, reducedMotion],
  );

  const showReadyIsland = useCallback(async () => {
    if (didShowInitialWindow.current) {
      return;
    }

    didShowInitialWindow.current = true;

    for (const delay of SHOW_RETRY_DELAYS_MS) {
      if (delay > 0) {
        await wait(delay);
      }
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

  useEffect(() => {
    const synced = syncNativeInteraction(
      mode,
      settings,
      expandedIslandHeight,
      expandedIslandWidth,
      collapsedIslandWidth,
      isTucked,
    );
    void Promise.race([synced, wait(SYNC_WAIT_BEFORE_SHOW_MS)]).finally(() => {
      void showReadyIsland();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    expandedIslandHeight,
    expandedIslandWidth,
    collapsedIslandWidth,
    isTucked,
    mode,
    settings.marginY,
    settings.islandForm,
    settings.appearanceMode,
    settings.glassIntensity,
    settings.islandBackgroundColor,
    settings.collapsedScale,
    settings.expandedScale,
    settings.islandCornerRadius,
    settings.islandCornerShape,
    settings.islandMonitor,
    showReadyIsland,
    syncNativeInteraction,
  ]);

  useClickFocus(mode === "expanded");
  useCollapseOnBlur(mode === "expanded", onCollapse);

  return { isPositionDetached, nativeGlassState, minimizeIsland, startIslandDrag, resetIslandPosition };
}
