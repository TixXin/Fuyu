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
import { useIslandShellPreparing } from "./IslandShell";
import { getTodoScrollStartRows } from "./layout";
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

function usePanelAwake(isExpanded: boolean, isPreparing: boolean, closeHoldMs: number): boolean {
  const [wasExpanded, setWasExpanded] = useState(isExpanded);
  const [closing, setClosing] = useState(false);
  if (wasExpanded !== isExpanded) {
    setWasExpanded(isExpanded);
    setClosing(!isExpanded && closeHoldMs > 0);
  }
  useEffect(() => {
    if (!closing || isExpanded || closeHoldMs <= 0) return;
    const timer = window.setTimeout(() => setClosing(false), closeHoldMs);
    return () => window.clearTimeout(timer);
  }, [closing, isExpanded, closeHoldMs]);
  return isExpanded || isPreparing || (closing && closeHoldMs > 0);
}

export function IslandPages(props: IslandPagesProps): ReactNode {
  const { page, mode, pluginPages, features, settings } = props;
  const t = useTranslation();
  const entries = useSlotEntries(pageSlot);
  const reducedMotion = useReducedMotion();
  const isPreparing = useIslandShellPreparing();
  const awake = usePanelAwake(mode === "expanded", isPreparing, getCloseHoldMs(settings.islandMotion, reducedMotion));
  if (!awake) return null;
  const pageProps: IslandPageProps = { ...props, onOpenSettings: openSettingsWindow, todoScrollStartRows: getTodoScrollStartRows(settings.maxPanelHeight) };
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
