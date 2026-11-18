import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "../../i18n";
import { PluginViewPage } from "../../features/plugin-views/PluginViewPage";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import type { IslandSettings } from "../../lib/settings/types";
import { islandMotionTiming } from "../../lib/theme/islandMotion";
import { useReducedMotion } from "../../lib/theme/useReducedMotion";
import type { useIslandFeatures } from "./useIslandFeatures";
import type { useIslandNavigation } from "./useIslandNavigation";
import type { usePluginPages } from "./usePluginPages";
import { openSettingsWindow } from "../settings/api";
import { useIslandShellPreparing, useIslandShellPrewarmed } from "./IslandShell";
import { getTodoScrollStartRows } from "./layout";
import {
  finishCloseHold,
  finishDeferredOpen,
  initialPanelAwakeState,
  isPanelAwake,
  syncPanelAwakeState,
} from "./panelAwake";
import { pageSlot } from "./slots/pageSlot";
import "./slots/builtins";

export type IslandPagesProps = {
  page: ReturnType<typeof useIslandNavigation>["page"];
  mode: ReturnType<typeof useIslandNavigation>["mode"];
  settings: IslandSettings;
  features: ReturnType<typeof useIslandFeatures>["features"];
  pluginPages: ReturnType<typeof usePluginPages>;
};

export type IslandPageProps = IslandPagesProps & {
  onOpenSettings: typeof openSettingsWindow;
  todoScrollStartRows: number;
  extraView?: { label: string; content: ReactNode };
  embedded?: boolean;
};

function getCloseHoldMs(islandMotion: IslandSettings["islandMotion"], reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  const timing = islandMotionTiming(islandMotion, "close", false);
  return Math.max(timing.width, timing.height, timing.layer);
}

function usePanelAwake(
  isExpanded: boolean,
  isPreparing: boolean,
  isPrewarmed: boolean,
  deferColdOpen: boolean,
  closeHoldMs: number,
): boolean {
  const input = { isExpanded, isPreparing, isPrewarmed, deferColdOpen, closeHoldMs };
  const [state, setState] = useState(() => initialPanelAwakeState(input));
  const synced = syncPanelAwakeState(state, input);
  if (synced !== state) {
    setState(synced);
  }

  useEffect(() => {
    if (!synced.deferringOpen) return;
    const frame = window.requestAnimationFrame(() => {
      setState((current) => finishDeferredOpen(current));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [synced.deferringOpen]);

  useEffect(() => {
    if (!synced.closing || isExpanded || closeHoldMs <= 0) return;
    const timer = window.setTimeout(() => {
      setState((current) => finishCloseHold(current, { isPreparing, isPrewarmed }));
    }, closeHoldMs);
    return () => window.clearTimeout(timer);
  }, [synced.closing, isExpanded, closeHoldMs, isPreparing, isPrewarmed]);

  return isPanelAwake(synced, input);
}

export function IslandPages(props: IslandPagesProps): ReactNode {
  const { page, mode, pluginPages, features, settings } = props;
  const t = useTranslation();
  const entries = useSlotEntries(pageSlot);
  const reducedMotion = useReducedMotion();
  const isPreparing = useIslandShellPreparing();
  const isPrewarmed = useIslandShellPrewarmed();
  const deferColdOpen = !reducedMotion && settings.islandMotion !== "none";
  const awake = usePanelAwake(
    mode === "expanded",
    isPreparing,
    isPrewarmed,
    deferColdOpen,
    getCloseHoldMs(settings.islandMotion, reducedMotion),
  );
  if (!awake) return null;
  const pageProps: IslandPageProps = {
    ...props,
    onOpenSettings: openSettingsWindow,
    todoScrollStartRows: getTodoScrollStartRows(settings.maxPanelHeight),
  };
  const folded = entries.find((entry) => entry.fold?.into === page && entry.fold.when(features));
  if (folded?.fold) {
    const Folded = folded.component;
    pageProps.extraView = { label: folded.fold.label(t), content: <Folded {...pageProps} embedded /> };
  }
  return (
    <>
      <SlotView slot={pageSlot} props={pageProps} select={(items) => items.filter((item) => item.id === page)} />
      {pluginPages.entry && <PluginViewPage entry={pluginPages.entry} isOpen={mode === "expanded"} />}
    </>
  );
}
