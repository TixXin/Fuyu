import { memo, useMemo, type Dispatch, type SetStateAction } from "react";
import type { IslandHost } from "../../features/plugin-kernel/islandHost";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { defineSlot } from "../../features/plugin-kernel/slots";
import type { IslandSettings } from "../../lib/settings/types";
import { openSettingsWindow } from "../settings/api";
import type { IslandFeatures } from "../island/features";
import type { IslandRunnerProps } from "../island/IslandRunners";
import type { IslandPage } from "../island/types";
import "../island/slots/builtins";

const runnerSlot = defineSlot<IslandRunnerProps>("island.runner/v1");

const PAGE_TO_RUNNERS: Readonly<Record<string, readonly string[]>> = {
  todo: ["todos.runner"],
  clipboard: ["clipboard.runner"],
  shelf: ["file-shelf.runner"],
  agents: ["agent-status.runner"],
  music: ["media.runner"],
  calendar: ["calendar.runner"],
  timer: ["timer.island"],
  qq: ["messages.runner"],
  screenshots: ["screenshot.runner"],
  translation: ["translation.peek"],
};

const noopUnlisten = async () => () => undefined;
const noopAsync = async () => undefined;
const noopTakeFocus = async () => false;

const SIDE_DOCK_HOST: IslandHost = {
  listenHover: noopUnlisten,
  listenOutsideClick: noopUnlisten,
  setOutsideClickWatch: noopAsync,
  listenBannerHover: noopUnlisten,
  setBannerRect: noopAsync,
};

const DEMO_OFF = { active: false, startedAt: 0 };

type SideDockRunnersProps = {
  pageIds: readonly string[];
  activePage: IslandPage;
  expanded: boolean;
  isLight: boolean;
  accent: string | null;
  settings: IslandSettings;
  setSettings: Dispatch<SetStateAction<IslandSettings>>;
  features: IslandFeatures;
  dragDropShelf: boolean;
  onOpenPage: (page: IslandPage) => void;
  onSelectPage: (page: IslandPage) => void;
  onCollapse: () => void;
  onReveal: () => void;
};

export const SideDockRunners = memo(function SideDockRunners({
  pageIds,
  activePage,
  expanded,
  isLight,
  accent,
  settings,
  setSettings,
  features,
  dragDropShelf,
  onOpenPage,
  onSelectPage,
  onCollapse,
  onReveal,
}: SideDockRunnersProps) {
  const neededIds = useMemo(() => {
    const ids = new Set<string>();
    for (const pageId of pageIds) {
      const runners = PAGE_TO_RUNNERS[pageId];
      if (!runners) continue;
      for (const runnerId of runners) ids.add(runnerId);
      if (pageId === "clipboard" && features.clipboardScreenshots) {
        ids.add("screenshot.runner");
      }
    }
    return ids;
  }, [features.clipboardScreenshots, pageIds]);

  const effectiveSettings = useMemo<IslandSettings>(
    () => (settings.shelfExpandOnDrop === dragDropShelf ? settings : { ...settings, shelfExpandOnDrop: dragDropShelf }),
    [dragDropShelf, settings],
  );

  const runnerProps = useMemo<IslandRunnerProps>(
    () => ({
      mode: expanded ? "expanded" : "collapsed",
      isTucked: false,
      quiet: true,
      barText: false,
      demo: DEMO_OFF,
      background: isLight ? "#f6f8fd" : "#0c0d12",
      accent,
      page: activePage,
      settings: effectiveSettings,
      setSettings,
      openSettings: openSettingsWindow,
      takeClickFocus: noopTakeFocus,
      host: SIDE_DOCK_HOST,
      features,
      openIslandPage: onOpenPage,
      setPage: onSelectPage,
      isPeeking: false,
      minimizeToEdge: onCollapse,
      openEnabledPage: onOpenPage,
      collapseIsland: onCollapse,
      tuckIsland: onCollapse,
      revealIsland: onReveal,
    }),
    [accent, activePage, effectiveSettings, expanded, features, isLight, onCollapse, onOpenPage, onReveal, onSelectPage, setSettings],
  );

  if (neededIds.size === 0) return null;

  return (
    <SlotView
      slot={runnerSlot}
      props={runnerProps}
      select={(items) => items.filter((item) => !item.external && neededIds.has(item.id))}
    />
  );
});
