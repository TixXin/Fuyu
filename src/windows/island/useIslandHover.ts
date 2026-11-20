import { useCallback } from "react";
import { useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import type { IslandSettings } from "../../lib/settings/types";
import { useHoverExpand } from "./useHoverExpand";
import { useHoverFocus } from "./useHoverFocus";
import type { useIslandNavigation } from "./useIslandNavigation";
import { usePanelPreview } from "./usePanelPreview";
import { useTuckedHoverOpen } from "./useTuckedHoverOpen";
import type { IslandPage } from "./types";

type IslandHoverOptions = {
  settings: IslandSettings;
  navigation: ReturnType<typeof useIslandNavigation>;
  quiet: boolean;
  homePage: IslandPage;
  openEnabledPage: (page: IslandPage) => void;
};

export function useIslandHover({ settings, navigation, quiet, homePage, openEnabledPage }: IslandHoverOptions) {
  const {
    mode, isTucked, isPeeking, openedByHover,
    collapseIsland, revealIsland, peekIsland, retractsAfterPeek, resumePeek, markHoverOpen,
  } = navigation;
  const { reveal } = useIslandContributed();
  const openCurrentPage = useCallback(
    () => openEnabledPage(homePage),
    [homePage, openEnabledPage],
  );
  const openFromTuckedHover = useCallback(() => {
    openCurrentPage();
    markHoverOpen();
  }, [markHoverOpen, openCurrentPage]);
  useHoverExpand({
    expandOnHover: settings.expandTrigger === "hover" && !quiet,
    collapseOnLeave: (settings.expandTrigger === "hover" || settings.clickCollapseOnLeave || openedByHover) && !quiet,
    delayMs: settings.hoverExpandDelayMs,
    paused: reveal.pauseHover,
    collapseDelayMs: settings.hoverCollapseDelayMs,
    mode,
    isTucked: isTucked || isPeeking,
    onExpand: openCurrentPage,
    onCollapse: collapseIsland,
  });
  const hoverTucked = useTuckedHoverOpen({
    opensPanel: settings.tuckedHoverAction === "expand" && !quiet,
    delayMs: settings.hoverExpandDelayMs,
    isTucked,
    isPeeking: isPeeking && mode === "collapsed",
    onPeek: peekIsland,
    onOpen: openFromTuckedHover,
    retractsAfterPeek,
    resumePeek,
  });
  useHoverFocus(mode, quiet || !settings.hoverTakesKeyboard);
  usePanelPreview({ mode, onExpand: openCurrentPage, onCollapse: collapseIsland, onReveal: revealIsland });
  return hoverTucked;
}
