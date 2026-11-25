import { useCallback, useMemo } from "react";
import { IslandPages } from "./IslandPages";
import { useTranslation } from "../../i18n";
import { openSettingsWindow } from "../settings/api";
import { hasActiveIslandBanner, takeIslandClickFocus } from "./api";
import { IslandHoverPreview } from "./IslandHoverPreview";
import { PREVIEW_HEIGHT, previewWidth as computePreviewWidth } from "./hoverPreview";
import { useHoverPreview } from "./useHoverPreview";
import { islandHost } from "./islandHost";
import { useIslandSettings } from "../../lib/settings/useIslandSettings";
import { useMigrateLegacySwitches, useSettingsWithBuiltinSwitches } from "../../features/plugin-kernel/useLegacySwitches";
import { IslandShell } from "./IslandShell";
import { IslandTaskbarParts, type IslandShellBase } from "./IslandTaskbarParts";
import { useTaskbarParts } from "./useTaskbarParts";
import { useIslandWindow } from "./useIslandWindow";
import { useNativeGlassSync } from "./useNativeGlassSync";
import { getExpandedIslandHeight } from "./expandedHeight";
import { getIslandStageStyle } from "./stageStyle";
import { useDevicePixelRatio } from "./useDevicePixelRatio";
import { useGameMode } from "./useGameMode";
import { useIslandKeyboard } from "./useIslandKeyboard";
import { usePageArrowKeys } from "./usePageArrowKeys";
import { usePageSwipe } from "./usePageSwipe";
import { IslandPageArrows } from "./IslandPageArrows";
import { useIslandFeatures } from "./useIslandFeatures";
import { useIslandNavigation } from "./useIslandNavigation";
import { useIslandTucking } from "./useIslandTucking";
import { useIslandOnTaskbar } from "./useIslandOnTaskbar";
import { useIslandHover } from "./useIslandHover";
import { useIslandPopup } from "./useIslandPopup";
import { editGrowWidth, PANEL_EDIT_GROW, usePanelEditing } from "./custom-panels/panelEditing";
import { COLLAPSED_ISLAND_HEIGHT, grownCollapsedHeight, maxExpandedIslandHeight, panelIslandWidth } from "./layout";
import { useResolvedTheme } from "../../lib/theme/useResolvedTheme";
import { surfaceThemeColors } from "../../lib/theme/themeMode";
import { islandMotionVariables } from "../../lib/theme/islandMotion";
import { useReducedMotion } from "../../lib/theme/useReducedMotion";
import { useIslandGlass } from "./useIslandGlass";
import { useIslandGlassStatus } from "./useIslandGlassStatus";
import { useAccentColor } from "../../lib/theme/useAccentColor";
import { useCollapsedGauges } from "./useCollapsedGauges";
import { mergeIslandDecor, useIslandDecor } from "../../features/plugin-kernel/islandDecor";
import { useTrayLanguage } from "./useTrayLanguage";
import { useTrayMark } from "./useTrayMark";
import { useFirstRunGuide } from "./useFirstRunGuide";
import { useSettingsFileSync } from "../../lib/settings-backup/useSettingsFileSync";
import { useOnboardingDemo } from "./useOnboardingDemo";
import { useIslandFirstHints } from "./useIslandFirstHints";
import { useV2UpgradeNotice } from "./useV2UpgradeNotice";
import { useIslandLayerNotice } from "./useIslandLayerNotice";
import { useIslandNotice } from "./islandNotice";
import { useIslandSide } from "./useIslandSide";
import { useSideDocksSync } from "../side-dock/useSideDocksSync";
import { sideColumnTarget } from "./sideColumn";
import { IslandRunners } from "./IslandRunners";
import { islandMarginY } from "./islandForm";
import { useAutoIslandForm } from "./autoIslandForm";
import { hasNotchDrop, notchBarWidth, notchExpandedExtra, notchFittedWidth, notchLook, notchPanelWidth, useIslandNotch, useNotchDropSync, useNotchTextRow, useNotchWingNeed } from "./notch";
import { anyNotchText } from "./notchText";
import { useNotchTextModes } from "../../lib/settings/collapsedText";
import "./IslandApp.css";
import { PluginSlot } from "../../features/plugin-kernel/PluginSlot";
import { runIslandAction, useIslandContributed, useSettleIslandContributions } from "../../features/plugin-kernel/useIslandContributions";
import { useCollapsedWidth } from "./useCollapsedWidth";
import { effectiveIslandOpacity } from "./idleDim";
import { useIdleDim } from "./useIdleDim";
import { overlaySlot } from "./slots/overlay";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import type { IslandPage } from "./types";
import { isPageEnabled, isPageShown } from "./features";
import { urgentPopupPage } from "../../features/plugin-kernel/islandContributions";
import { FUYU_PAGE_ID } from "../../lib/settings/customPanels";
import { IslandResize } from "./resize/IslandResize";
import { useIslandResize } from "./resize/useIslandResize";
import { islandPageSize, widestPageWidth } from "./pageSize";
import { useNotchRimView } from "./notch-rim/useNotchRimView";
import { useNotchRingView } from "./notch-ring/useNotchRingView";
import { ringLit } from "./notch-ring/ringPlan";
import { notchRingExtra, notchRingLook } from "../../lib/settings/notchRingSettings";
import { JellyfishStyleContext } from "../../components/jellyfish/jellyfishStyleContext";

const openTranslator = () => {
  runIslandAction("translation.open");
};

export function IslandApp() {
  const t = useTranslation();
  useTrayLanguage();
  useSettingsFileSync();
  const navigation = useIslandNavigation();
  const { mode, isTucked, page, setPage, collapseIsland, tuckIsland, revealIsland, minimizeToEdge, openIslandPage } = navigation;
  const side = useIslandSide();
  const [storedSettings, setSettings] = useIslandSettings();
  useMigrateLegacySwitches(storedSettings);
  const settings = useResolvedTheme(useSettingsWithBuiltinSwitches(storedSettings));
  useTrayMark(settings.jellyfishStyle);
  const game = useGameMode(settings, { mode, isTucked, collapseIsland, tuckIsland, revealIsland });
  const director = useMemo(
    () => ({ openIslandPage, collapseIsland, tuckIsland, revealIsland }),
    [openIslandPage, collapseIsland, tuckIsland, revealIsland],
  );
  useFirstRunGuide(director);
  const demo = useOnboardingDemo();
  const decor = useIslandDecor();
  const gauges = useCollapsedGauges(mode !== "collapsed" || isTucked || game.quiet);
  const collapsedSlots = useMemo(() => mergeIslandDecor([decor, gauges]), [decor, gauges]);

  const firstHints = useIslandFirstHints({
    mode,
    isTucked,
    quiet: game.quiet,
    demoActive: demo.active,
  });
  const v2Upgrade = useV2UpgradeNotice({
    mode,
    isTucked,
    quiet: game.quiet,
    demoActive: demo.active,
  });
  const layerNotice = useIslandLayerNotice({ mode, isTucked, shortcut: settings.islandLayerShortcut });
  const notch = useIslandNotch();
  const autoForm = useAutoIslandForm();
  const barText = settings.showCollapsedText && !notch;
  const notchModes = useNotchTextModes();
  const notchText = notch !== null && settings.showCollapsedText && anyNotchText(notchModes);
  const notchRow = useNotchTextRow();
  const { lines: contributedLines, alerts, popups, style, settled, preview: contributedPreview, reveal: contributedReveal, status: contributedStatus, summaryGrow, glow: contributedGlow } = useIslandContributed();
  const grow = mode === "collapsed" && !isTucked && notch === null && side === null ? summaryGrow : null;
  const textWidth = useCollapsedWidth({
    barText,
    noticeText: layerNotice.text ?? v2Upgrade.text ?? (firstHints.current ? t.island.firstHint[firstHints.current] : null),
    showTitle: settings.showTitle,
    widthExtra: settings.collapsedWidthExtra,
    peeking: contributedPreview !== null || contributedLines.some((line) => line.drop === true),
    slots: collapsedSlots,
    collapsedScale: settings.collapsedScale,
    growWidth: grow?.width ?? 0,
  });
  const collapsedIslandHeight = grownCollapsedHeight(grow?.height ?? COLLAPSED_ISLAND_HEIGHT);
  const notchWingNeed = useNotchWingNeed();
  const collapsedIslandWidth = notchFittedWidth(textWidth, notch, settings.collapsedScale, alerts.size > 0, Math.max(settings.notchWingMax, notchWingNeed ?? 0));
  useIslandTucking({ settings, navigation });
  useSideDocksSync(side, game.quiet);

  const { features, openEnabledPage } = useIslandFeatures({
    settings,
    page,
    setPage,
    openIslandPage,
    islandSide: side,
  });
  const urgentPage = urgentPopupPage(popups) as IslandPage | null;
  const homePage: IslandPage = urgentPage && isPageEnabled(urgentPage, features)
    ? urgentPage
    : isPageShown(FUYU_PAGE_ID, features) ? FUYU_PAGE_ID : page;
  const openPopup = [...popups.values()].find((entry) => entry.open === true);
  const hasOpenPopup = openPopup !== undefined;
  const panelEditing = usePanelEditing() !== null && !hasOpenPopup;
  const fuyuPage = page === FUYU_PAGE_ID && !hasOpenPopup;
  const pageSize = islandPageSize(settings, page);
  const panelWidth = pageSize.width;
  const editGrow = panelEditing ? editGrowWidth(panelIslandWidth(panelWidth, settings.expandedScale), settings.expandedScale) : 0;
  const { popup, expandedIslandWidth: popupWidth } = useIslandPopup(
    mode,
    hasOpenPopup,
    null,
    panelIslandWidth(panelWidth + editGrow, settings.expandedScale),
    openPopup?.wide === true,
  );
  const resizeModel = useIslandResize(settings, setSettings, page, pageSize, notch !== null);
  const expandedIslandWidth = notchPanelWidth(popupWidth, notch, settings.expandedScale, popup);
  const widestIslandWidth = notchPanelWidth(panelIslandWidth(widestPageWidth(settings), settings.expandedScale), notch, settings.expandedScale, false);
  const pageIslandHeight = fuyuPage && !popup ? pageSize.height : getExpandedIslandHeight({ maxPanelHeight: pageSize.height, panel: popups.get(page), popup });
  const editGrowHeight = panelEditing && !popup ? PANEL_EDIT_GROW.height : 0;
  const expandedIslandHeight = Math.min(
    maxExpandedIslandHeight(settings.expandedScale),
    pageIslandHeight + editGrowHeight + notchExpandedExtra(notch, settings.expandedScale, popup),
  );
  const islandNotice = useIslandNotice({ firstHints, v2Upgrade, layer: layerNotice });
  const isDimmed = useIdleDim({
    enabled: settings.idleDim,
    seconds: settings.idleDimSeconds,
    mode,
    isTucked,
    demoActive: demo.active,
    hasNotice: islandNotice !== null,
    hasPreview: contributedPreview !== null,
    hasAlert: alerts.size > 0,
    hasOpenPopup,
    hasReveal: contributedReveal.always || contributedReveal.allowed || contributedReveal.pauseIdle,
    hasAgentInterjection: contributedLines.some((line) => line.interjection === true),
    agentWaiting: contributedStatus?.state === "waiting",
  });
  const islandOpacity = effectiveIslandOpacity(settings, { mode, isTucked, isDimmed });
  const look = useMemo(() => (mode !== "collapsed" ? surfaceThemeColors(settings, "panel") : notch ? notchLook(settings) : surfaceThemeColors(settings, "collapsed")), [mode, notch, settings]);
  const accent = useAccentColor(settings);
  const notchRim = useNotchRimView(settings, accent, game.quiet);
  const notchRing = useNotchRingView(settings, accent, game.quiet);
  const ringExtra = notch && mode === "collapsed" && !isTucked ? notchRingExtra(settings, ringLit(notchRingLook(settings, "Island"), contributedGlow), settings.collapsedScale) : 0;
  const devicePixelRatio = useDevicePixelRatio();
  const reducedMotion = useReducedMotion();
  const { glass, glassStyle, layerState } = useIslandGlass({ settings, background: look.islandBackgroundColor, accent, cover: style.tint, mode, isTucked, quiet: game.quiet, reducedMotion });
  const onTaskbar = useIslandOnTaskbar();
  const taskbarParts = useTaskbarParts({
    onTaskbar, settings, look, mode, docked: side === null && notch === null, accent, devicePixelRatio,
    collapsedIslandWidth, expandedIslandHeight, expandedIslandWidth,
  });
  const { taskbarClear, lightStage } = taskbarParts;
  const stageStyle = useMemo(
    () => ({
      ...getIslandStageStyle(look, mode, collapsedIslandWidth, expandedIslandHeight, expandedIslandWidth, accent, devicePixelRatio),
      ...islandMotionVariables(settings.islandMotion, mode === "collapsed" ? "close" : "open", reducedMotion, settings.islandBounce),
      ...(collapsedIslandHeight !== COLLAPSED_ISLAND_HEIGHT ? { "--collapsed-island-height": `${collapsedIslandHeight}px` } : {}),
      ...(ringExtra > 0 ? { "--island-notch-ring-extra": `${ringExtra}px` } : {}),
      ...(islandOpacity < 1 ? { "--island-opacity": String(islandOpacity) } : {}),
      ...(settings.islandMotion === "none" ? { "--island-opacity-duration": "0ms" } : {}),
      ...style.vars,
      ...glassStyle,
    }),
    [collapsedIslandWidth, collapsedIslandHeight, ringExtra, expandedIslandHeight, expandedIslandWidth, mode, look, accent, devicePixelRatio, settings.islandMotion, settings.islandBounce, reducedMotion, islandOpacity, style.vars, glassStyle],
  );

  const previewTargetWidth = computePreviewWidth(collapsedIslandWidth, expandedIslandWidth);
  const { previewOpen, closePreview } = useHoverPreview({
    enabled: settings.expandTrigger === "preview" && side === null && !game.quiet && !onTaskbar.placed,
    delayMs: settings.hoverExpandDelayMs,
    autoExpandMs: settings.previewAutoExpandMs,
    paused: contributedReveal.pauseHover || contributedPreview !== null || hasActiveIslandBanner(),
    mode,
    isTucked: isTucked || navigation.isPeeking,
    onExpand: () => openEnabledPage(homePage),
  });
  const {
    isPositionDetached,
    nativeGlassState,
    minimizeIsland,
    startIslandDrag,
    resetIslandPosition,
  } = useIslandWindow({
    mode,
    previewOpen,
    previewWidth: previewTargetWidth,
    previewHeight: PREVIEW_HEIGHT,
    isTucked,
    isDimmed,
    gamePassthrough: game.passthrough,
    settings,
    setSettings,
    backgroundColor: look.islandBackgroundColor,
    expandedIslandHeight,
    expandedIslandWidth,
    widestIslandWidth,
    collapsedIslandWidth,
    collapsedIslandHeight,
    notchRingExtra: ringExtra,
    ready: settled,
    onCollapse: collapseIsland,
  });

  useNativeGlassSync(settings.appearanceMode === "liquidGlass" && settings.glassBackdrop === "native");
  useIslandGlassStatus({ settings, nativeGlassState, layer: layerState });

  useNotchDropSync(notch !== null && mode === "collapsed" && !isTucked && hasNotchDrop({
    preview: contributedPreview, notice: islandNotice !== null, peek: contributedLines.some((line) => line.drop === true), row: notchText && notchRow,
  }));
  const hoverTucked = useIslandHover({
    settings,
    navigation,
    quiet: game.quiet,
    homePage,
    openEnabledPage,
  });

  const openSettingsFromPanel = useCallback((section?: "updates") => {
    openSettingsWindow(section);
    collapseIsland();
  }, [collapseIsland]);

  useIslandKeyboard(
    collapseIsland,
    openSettingsFromPanel,
    mode,
    features,
    page,
    setPage,
    settings.pageDigitModifiers,
    settings.pageNextShortcut,
    settings.pagePreviousShortcut,
  );
  usePageArrowKeys({
    enabled: settings.pageArrowKeys,
    mode,
    blocked: hasOpenPopup || panelEditing,
    features,
    page,
    homePage,
    onPageChange: setPage,
    onOpenPage: openEnabledPage,
    onCollapse: collapseIsland,
  });
  usePageSwipe({ enabled: settings.pageSwipe && mode === "expanded" && !hasOpenPopup && !panelEditing, features, page, onPageChange: setPage });


  useSettleIslandContributions();

  const pageSwitch = useMemo(
    () => ({ effect: settings.pageSwitchPanel, speed: settings.pageSwitchSpeed, directional: settings.pageSwitchDirectional }),
    [settings.pageSwitchPanel, settings.pageSwitchSpeed, settings.pageSwitchDirectional],
  );
  const shell: IslandShellBase = {
    page,
    homePage,
    popup,
    appearanceMode: settings.appearanceMode,
    nativeGlassState,
    hoverGrow: settings.islandHover,
    hoverBounce: settings.islandBounce,
    glass: { ...glass, nativeState: nativeGlassState },
    isTucked,
    isDimmed,
    tuckStyle: settings.tuckStyle,
    tuckLipWidth: settings.tuckLipWidth,
    tuckHint: settings,
    isDetached: isPositionDetached || islandMarginY(settings, autoForm) > 0,
    side,
    sideHeight: sideColumnTarget({ mode: settings.sideHeightMode, custom: settings.sideHeight, maxPanelHeight: settings.maxPanelHeight, expandedScale: settings.expandedScale, collapsedScale: settings.collapsedScale }),
    showTitle: settings.showTitle,
    showCollapsedText: barText,
    overflowMore: settings.collapsedOverflowMore,
    notchWingMax: settings.notchWingMax,
    notchText,
    notchRim,
    notchRing,
    features,
    onOpenPage: openEnabledPage,
    taskbarHandle: onTaskbar.placed ? (settings.expandTrigger === "hover" ? "modifier" : "hover") : null,
    onWindowDragStart: startIslandDrag,
    onCollapse: collapseIsland,
    onResetPosition: resetIslandPosition,
    minimizesToTray: settings.minimizeAction === "tray",
    onMinimize: settings.minimizeAction === "tray" ? minimizeIsland : minimizeToEdge,
    onOpenTranslator: features.translation ? openTranslator : null,
    onOpenSettings: openSettingsFromPanel,
    onTuck: tuckIsland,
    onReveal: hoverTucked,
    onPageChange: setPage,
    pageDigitModifiers: settings.pageDigitModifiers,
    hoverSwitchPage: settings.hoverSwitchPage,
    hoverSwitchDelayMs: settings.hoverSwitchDelayMs,
    wheelSwitchPage: settings.wheelSwitchPage,
    preview: previewOpen,
    previewWidth: previewTargetWidth,
    previewContent: previewOpen ? (
      <IslandHoverPreview
        homePage={homePage}
        autoExpandMs={settings.previewAutoExpandMs}
        onOpenPage={openEnabledPage}
        onExpand={() => openEnabledPage(homePage)}
        onClose={closePreview}
      />
    ) : null,
    fuyuTabIcon: settings.fuyuTabIcon,
    notice: islandNotice,
    collapsedSlots,
    pageSwitch,
    pageArrows: settings.pageArrows && !hasOpenPopup && !panelEditing && side === null ? <IslandPageArrows features={features} page={page} onPageChange={setPage} /> : null,
    resize: <IslandResize model={resizeModel} expanded={mode === "expanded"} enabled={!popup && !isTucked && side === null && !taskbarParts.panelled} size={pageSize} extra={settings[resizeModel.barKey]} barWidth={notch ? (wing) => notchBarWidth(notch, settings.collapsedScale, wing) : undefined} />,
  };
  const pages = (
    <>
      <PluginSlot window="island" name="island.dev/v1" />
      <IslandPages
        page={page}
        mode={mode}
        settings={settings}
        features={features}
      />
    </>
  );

  return (
    <JellyfishStyleContext.Provider value={settings.jellyfishStyle}>
      <main className={`stage stage--font-${settings.fontFamily}${lightStage ? " island-light" : ""}${taskbarClear ? " stage--taskbar-clear" : ""}${style.classNames.map((name) => ` ${name}`).join("")}`} style={stageStyle}>
        <IslandRunners mode={mode} page={page} isTucked={isTucked} quiet={game.quiet} barText={barText || notchText} setSettings={setSettings} openSettings={openSettingsWindow} takeClickFocus={takeIslandClickFocus} host={islandHost} demo={demo} background={look.islandBackgroundColor} accent={accent} settings={settings} features={features} openIslandPage={openIslandPage} setPage={setPage} isPeeking={navigation.isPeeking} minimizeToEdge={minimizeToEdge} openEnabledPage={openEnabledPage} collapseIsland={collapseIsland} tuckIsland={tuckIsland} revealIsland={revealIsland} />
        {taskbarParts.panelled ? (
          <IslandTaskbarParts shell={shell} mode={mode} parts={taskbarParts} lift={onTaskbar.lift}>
            {pages}
          </IslandTaskbarParts>
        ) : (
          <IslandShell mode={mode} {...shell}>
            {pages}
          </IslandShell>
        )}
        <SlotView slot={overlaySlot} props={{}} />
      </main>
    </JellyfishStyleContext.Provider>
  );
}
