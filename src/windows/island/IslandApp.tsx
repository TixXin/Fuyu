import { useMemo } from "react";
import { IslandPages } from "./IslandPages";
import { useTranslation } from "../../i18n";
import { openSettingsWindow } from "../settings/api";
import { takeIslandClickFocus } from "./api";
import { islandHost } from "./islandHost";
import { useIslandSettings } from "../../lib/settings/useIslandSettings";
import { useMigrateLegacySwitches, useSettingsWithBuiltinSwitches } from "../../features/plugin-kernel/useLegacySwitches";
import { IslandShell } from "./IslandShell";
import { useIslandWindow } from "./useIslandWindow";
import { useNativeGlassSync } from "./useNativeGlassSync";
import { getExpandedIslandHeight } from "./expandedHeight";
import { getIslandStageStyle } from "./stageStyle";
import { useDevicePixelRatio } from "./useDevicePixelRatio";
import { useGameMode } from "./useGameMode";
import { useIslandKeyboard } from "./useIslandKeyboard";
import { useIslandFeatures } from "./useIslandFeatures";
import { useIslandNavigation } from "./useIslandNavigation";
import { useIslandTucking } from "./useIslandTucking";
import { useIslandHover } from "./useIslandHover";
import { useIslandPopup } from "./useIslandPopup";
import { panelIslandWidth } from "./layout";
import { useIslandResize } from "./useIslandResize";
import { useResolvedTheme } from "../../lib/theme/useResolvedTheme";
import { surfaceThemeColors } from "../../lib/theme/themeMode";
import { islandMotionVariables } from "../../lib/theme/islandMotion";
import { useReducedMotion } from "../../lib/theme/useReducedMotion";
import { useIslandGlass } from "./useIslandGlass";
import { useIslandGlassStatus } from "./useIslandGlassStatus";
import { useAccentColor } from "../../lib/theme/useAccentColor";
import { isLightIsland } from "../../utils/color";
import { useCollapsedGauges } from "./useCollapsedGauges";
import { mergeIslandDecor, useIslandDecor } from "../../features/plugin-kernel/islandDecor";
import { useTrayLanguage } from "./useTrayLanguage";
import { useFirstRunGuide } from "./useFirstRunGuide";
import { useSettingsFileSync } from "../../lib/settings-backup/useSettingsFileSync";
import { useOnboardingDemo } from "./useOnboardingDemo";
import { useIslandFirstHints } from "./useIslandFirstHints";
import { useV2UpgradeNotice } from "./useV2UpgradeNotice";
import { useIslandNotice } from "./islandNotice";
import { useIslandSide } from "./useIslandSide";
import { IslandRunners } from "./IslandRunners";
import { islandMarginY } from "./islandForm";
import { useAutoIslandForm } from "./autoIslandForm";
import { hasNotchDrop, notchExpandedExtra, notchFittedWidth, notchLook, notchPanelWidth, useIslandNotch, useNotchDropSync } from "./notch";
import "./IslandApp.css";
import { PluginSlot } from "../../features/plugin-kernel/PluginSlot";
import { LINE_PRIORITY, leadLine } from "../../features/plugin-kernel/islandContributions";
import { runIslandAction, useIslandContributed, useSettleIslandContributions } from "../../features/plugin-kernel/useIslandContributions";
import { useCollapsedWidth } from "./useCollapsedWidth";
import { effectiveIslandOpacity } from "./idleDim";
import { useIdleDim } from "./useIdleDim";
import { overlaySlot } from "./slots/overlay";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import type { IslandPage } from "./types";

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
  const game = useGameMode(settings, { mode, isTucked, collapseIsland, tuckIsland, revealIsland });
  useFirstRunGuide();
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
  const notch = useIslandNotch();
  const autoForm = useAutoIslandForm();
  const barText = settings.showCollapsedText && !notch;
  const { lines: contributedLines, alerts, popups, style, settled, preview: contributedPreview, reveal: contributedReveal, status: contributedStatus } = useIslandContributed();
  const textWidth = useCollapsedWidth({
    barText,
    noticeText: v2Upgrade.text ?? (firstHints.current ? t.island.firstHint[firstHints.current] : null),
    showTitle: settings.showTitle,
    widthExtra: settings.collapsedWidthExtra,
    peeking: contributedPreview !== null || contributedLines.some((line) => line.drop === true),
    slots: collapsedSlots,
    collapsedScale: settings.collapsedScale,
  });
  const collapsedIslandWidth = notchFittedWidth(textWidth, notch, settings.collapsedScale, alerts.size > 0);
  useIslandTucking({ settings, navigation });


  const { features, openEnabledPage } = useIslandFeatures({
    settings,
    page,
    setPage,
    openIslandPage,
  });
  const hasOpenPopup = [...popups.values()].some((entry) => entry.open === true);
  const { popup, expandedIslandWidth: popupWidth } = useIslandPopup(
    mode,
    hasOpenPopup,
    null,
    panelIslandWidth(settings.panelWidth, settings.expandedScale),
  );
  const expandedIslandWidth = notchPanelWidth(popupWidth, notch, settings.expandedScale, popup);
  const { resizingHeight, resizing } = useIslandResize(settings, setSettings, popup);
  const pageIslandHeight = getExpandedIslandHeight({ maxPanelHeight: settings.maxPanelHeight, panel: popups.get(page), popup });
  const expandedIslandHeight = (resizingHeight && !popup ? settings.maxPanelHeight : pageIslandHeight) + notchExpandedExtra(notch, settings.expandedScale, popup);
  const islandNotice = useIslandNotice({ firstHints, v2Upgrade });
  const isDimmed = useIdleDim({
    enabled: settings.idleDim,
    seconds: settings.idleDimSeconds,
    mode,
    isTucked,
    resizing: resizing !== null,
    demoActive: demo.active,
    hasNotice: islandNotice !== null,
    hasPreview: contributedPreview !== null,
    hasAlert: alerts.size > 0,
    hasOpenPopup,
    hasReveal: contributedReveal.always || contributedReveal.allowed || contributedReveal.pauseIdle,
    hasAgentInterjection: contributedLines.some((line) => line.priority === LINE_PRIORITY.agentInterjection),
    agentWaiting: contributedStatus?.state === "waiting",
  });
  const islandOpacity = effectiveIslandOpacity(settings, { mode, isTucked, isDimmed });
  const look = useMemo(() => (mode !== "collapsed" ? surfaceThemeColors(settings, "panel") : notch ? notchLook(settings) : surfaceThemeColors(settings, "collapsed")), [mode, notch, settings]);
  const accent = useAccentColor(settings);
  const devicePixelRatio = useDevicePixelRatio();
  const reducedMotion = useReducedMotion();
  const { glass, glassStyle, layerState } = useIslandGlass({ settings, background: look.islandBackgroundColor, accent, cover: style.tint, mode, isTucked, quiet: game.quiet, reducedMotion });
  const stageStyle = useMemo(
    () => ({
      ...getIslandStageStyle(look, mode, collapsedIslandWidth, expandedIslandHeight, expandedIslandWidth, accent, devicePixelRatio),
      ...islandMotionVariables(settings.islandMotion, mode === "collapsed" ? "close" : "open", reducedMotion),
      ...(islandOpacity < 1 ? { "--island-opacity": String(islandOpacity) } : {}),
      ...(settings.islandMotion === "none" ? { "--island-opacity-duration": "0ms" } : {}),
      ...style.vars,
      ...glassStyle,
    }),
    [collapsedIslandWidth, expandedIslandHeight, expandedIslandWidth, mode, look, accent, devicePixelRatio, settings.islandMotion, reducedMotion, islandOpacity, style.vars, glassStyle],
  );

  const {
    isPositionDetached,
    nativeGlassState,
    minimizeIsland,
    startIslandDrag,
    resetIslandPosition,
  } = useIslandWindow({
    mode,
    isTucked,
    isDimmed,
    gamePassthrough: game.passthrough,
    settings,
    setSettings,
    backgroundColor: look.islandBackgroundColor,
    expandedIslandHeight,
    expandedIslandWidth,
    collapsedIslandWidth,
    ready: settled,
    onCollapse: collapseIsland,
  });

  useNativeGlassSync(settings.appearanceMode === "liquidGlass" && settings.glassBackdrop === "native");
  useIslandGlassStatus({ settings, nativeGlassState, layer: layerState });

  useNotchDropSync(notch !== null && mode === "collapsed" && !isTucked && hasNotchDrop({
    preview: contributedPreview, notice: islandNotice !== null, peek: contributedLines.some((line) => line.drop === true),
  }));
  const hoverTucked = useIslandHover({
    settings,
    navigation,
    quiet: game.quiet,
    leadPage: (leadLine(contributedLines, { reserved: true })?.page ?? null) as IslandPage | null,
    openEnabledPage,
  });

  useIslandKeyboard(
    collapseIsland,
    mode,
    features,
    page,
    setPage,
    settings.pageDigitModifiers,
    settings.pageNextShortcut,
    settings.pagePreviousShortcut,
  );


  useSettleIslandContributions();

  return (
    <main className={`stage stage--font-${settings.fontFamily}${isLightIsland(look.islandBackgroundColor) ? " island-light" : ""}${style.classNames.map((name) => ` ${name}`).join("")}`} style={stageStyle}>
      <IslandRunners mode={mode} page={page} isTucked={isTucked} quiet={game.quiet} barText={barText} setSettings={setSettings} openSettings={openSettingsWindow} takeClickFocus={takeIslandClickFocus} host={islandHost} demo={demo} background={look.islandBackgroundColor} accent={accent} settings={settings} features={features} openIslandPage={openIslandPage} setPage={setPage} isPeeking={navigation.isPeeking} minimizeToEdge={minimizeToEdge} openEnabledPage={openEnabledPage} collapseIsland={collapseIsland} tuckIsland={tuckIsland} revealIsland={revealIsland} />
      <IslandShell
        mode={mode}
        page={page}
        popup={popup}
        resizeLabel={resizing === "collapsed" ? `${collapsedIslandWidth} px` : resizing ? `${expandedIslandWidth} × ${settings.maxPanelHeight}` : null}
        appearanceMode={settings.appearanceMode}
        nativeGlassState={nativeGlassState}
        glass={{ ...glass, nativeState: nativeGlassState }}
        isTucked={isTucked}
        isDimmed={isDimmed}
        tuckStyle={settings.tuckStyle}
        tuckHint={settings}
        isDetached={isPositionDetached || islandMarginY(settings, autoForm) > 0}
        side={side}
        showTitle={settings.showTitle}
        showCollapsedText={barText}
        features={features}
        onOpenPage={openEnabledPage}
        onWindowDragStart={startIslandDrag}
        onCollapse={collapseIsland}
        onResetPosition={resetIslandPosition}
        minimizesToTray={settings.minimizeAction === "tray"}
        onMinimize={settings.minimizeAction === "tray" ? minimizeIsland : minimizeToEdge}
        onOpenTranslator={features.translation ? openTranslator : null}
        onOpenSettings={openSettingsWindow}
        onTuck={tuckIsland}
        onReveal={hoverTucked}
        onPageChange={setPage}
        pageDigitModifiers={settings.pageDigitModifiers}
        hoverSwitchPage={settings.hoverSwitchPage}
        hoverSwitchDelayMs={settings.hoverSwitchDelayMs}
        notice={islandNotice}
        collapsedSlots={collapsedSlots}
      >
        <PluginSlot window="island" name="island.dev/v1" />
        <IslandPages
          page={page}
          mode={mode}
          settings={settings}
          features={features}
        />
      </IslandShell>
      <SlotView slot={overlaySlot} props={{}} />
    </main>
  );
}
