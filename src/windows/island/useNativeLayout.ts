import { useCallback, useEffect, useRef } from "react";
import type { IslandSettings } from "../../lib/settings/types";
import * as islandApi from "./api";
import { useAutoIslandForm } from "./autoIslandForm";
import { islandFormLayout, shownIslandForm } from "./islandForm";
import { useIslandForm } from "./useIslandForm";

function formMotion(settings: IslandSettings) {
  return settings.islandMotion !== "none" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useNativeLayout(settings: IslandSettings) {
  const layoutSync = useRef<{
    frame: number | null;
    inFlight: boolean;
    pending: IslandSettings;
    active: IslandSettings;
  }>({
    frame: null,
    inFlight: false,
    pending: settings,
    active: settings,
  });
  const syncedForm = useRef(settings.islandForm);
  useIslandForm(shownIslandForm(settings.islandForm, useAutoIslandForm()));

  const syncNativeLayout = useCallback(async (nextSettings: IslandSettings) => {
    const animate = syncedForm.current !== nextSettings.islandForm && formMotion(nextSettings);
    syncedForm.current = nextSettings.islandForm;
    try {
      await islandApi.setIslandLayout({
        collapsedScale: nextSettings.collapsedScale,
        expandedScale: nextSettings.expandedScale,
        ...islandFormLayout(nextSettings),
        dragGrid: nextSettings.dragGrid,
        tuckStyle: nextSettings.tuckStyle,
        animate,
      });
    } catch (error) {
      console.error("Failed to sync island layout", error);
    }
  }, []);

  const flushNativeLayout = useCallback(() => {
    const syncState = layoutSync.current;

    if (syncState.inFlight) {
      return;
    }

    const nextSettings = syncState.pending;
    syncState.active = nextSettings;
    syncState.inFlight = true;

    void syncNativeLayout(nextSettings).finally(() => {
      const latestState = layoutSync.current;
      latestState.inFlight = false;

      if (latestState.pending !== latestState.active) {
        latestState.frame = window.requestAnimationFrame(() => {
          latestState.frame = null;
          flushNativeLayout();
        });
      }
    });
  }, [syncNativeLayout]);

  const scheduleNativeLayout = useCallback(
    (nextSettings: IslandSettings) => {
      const syncState = layoutSync.current;
      syncState.pending = nextSettings;

      if (syncState.frame !== null || syncState.inFlight) {
        return;
      }

      syncState.frame = window.requestAnimationFrame(() => {
        syncState.frame = null;
        flushNativeLayout();
      });
    },
    [flushNativeLayout],
  );

  useEffect(() => {
    scheduleNativeLayout(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.marginY, settings.menuBarPlacement, settings.islandForm, settings.dragGrid, settings.tuckStyle, scheduleNativeLayout]);

  useEffect(() => {
    const syncState = layoutSync.current;
    return () => {
      if (syncState.frame !== null) {
        window.cancelAnimationFrame(syncState.frame);
        syncState.frame = null;
      }
    };
  }, []);

  return syncNativeLayout;
}
