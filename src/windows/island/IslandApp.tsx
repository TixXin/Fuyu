import { useMemo } from "react";
import { useIslandNotices } from "./useIslandNotices";
import { PluginPermissionPrompt } from "../../features/plugins/PluginPermissionPrompt";
import { PluginContextMenus } from "../../features/plugins/PluginContextMenu";
import { IslandPages } from "./IslandPages";
import { useTranslation } from "../../i18n";
import { openSettingsWindow } from "../settings/api";
import { takeIslandClickFocus } from "./api";
import { islandHost } from "./islandHost";
import { useClipboardCopyCard } from "../../features/clipboard/useClipboardCopyCard";
import { useIslandSettings } from "../../lib/settings/useIslandSettings";
import { useLegacySwitches } from "../../features/plugin-kernel/useLegacySwitches";
import { useClipboardHistory } from "../../features/clipboard/useClipboardHistory";
import { IslandShell } from "./IslandShell";
import { useBackgroundUpdateCheck } from "../../features/updater/useBackgroundUpdateCheck";
import { useIslandWindow } from "./useIslandWindow";
import { getExpandedIslandHeight } from "./expandedHeight";
import { getIslandStageStyle } from "./stageStyle";
import { useDevicePixelRatio } from "./useDevicePixelRatio";
import { useGameMode } from "./useGameMode";
import { useIslandKeyboard } from "./useIslandKeyboard";
import { useIslandFeatures } from "./useIslandFeatures";
import { useIslandAutoUpdate } from "./useIslandAutoUpdate";
import { useIslandNavigation } from "./useIslandNavigation";
import { usePluginHostEvents } from "./usePluginHostEvents";
import { usePluginKeybindings } from "./usePluginKeybindings";
import { useIslandTucking } from "./useIslandTucking";
import { useTuckHold } from "./useTuckHold";
import { useIslandShelf } from "./useIslandShelf";
import { useIslandHover } from "./useIslandHover";
import { usePluginPages } from "./usePluginPages";
import { useMessageView } from "./useMessageView";
import { useIslandBanner } from "./useIslandBanner";
import { useIslandMessagePanel } from "./useIslandMessagePanel";
import { useIslandPopup } from "./useIslandPopup";
import { panelIslandWidth } from "./layout";
import { useIslandResize } from "./useIslandResize";
import { useResolvedTheme } from "../../lib/theme/useResolvedTheme";
import { surfaceThemeColors } from "../../lib/theme/themeMode";
import { islandMotionVariables } from "../../lib/theme/islandMotion";
import { useReducedMotion } from "../../lib/theme/useReducedMotion";
import { useIslandGlass } from "./useIslandGlass";
import { useAccentColor } from "../../lib/theme/useAccentColor";
import { isLightIsland } from "../../utils/color";
import { PluginPageButtons } from "./PluginPageButtons";
import { useCollapsedGauges } from "./useCollapsedGauges";
import { mergeIslandDecor, useIslandDecor } from "../../features/plugin-kernel/islandDecor";
import { useTrayLanguage } from "./useTrayLanguage";
import { useFirstRunGuide } from "./useFirstRunGuide";
import { useSettingsFileSync } from "../../lib/settings-backup/useSettingsFileSync";
import { useOnboardingDemo } from "./useOnboardingDemo";
import { useIslandFirstHints } from "./useIslandFirstHints";
import { useIslandNotice } from "./islandNotice";
import { useIslandSide } from "./useIslandSide";
import { IslandRunners } from "./IslandRunners";
import { islandMarginY } from "./islandForm";
import { hasNotchDrop, notchExpandedExtra, notchFittedWidth, notchLook, notchPanelWidth, useIslandNotch, useNotchDropSync } from "./notch";
import "./IslandApp.css";
import { PluginSlot } from "../../features/plugin-kernel/PluginSlot";
import { leadLine } from "../../features/plugin-kernel/islandContributions";
import { runIslandAction, useIslandContributed, useSettleIslandContributions } from "../../features/plugin-kernel/useIslandContributions";
import { useCollapsedWidth } from "./useCollapsedWidth";
import { overlaySlot } from "./slots/overlay";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { useLegacyPopups } from "./legacyPopups";
import { useLegacyStates } from "./legacyStates";
import type { IslandPage } from "./types";

const openTranslator = () => {
  runIslandAction("translation.open");
};
const openUpdateSettings = () => {
  openSettingsWindow("updates");
};

export function IslandApp() {
  const t = useTranslation();
  useTrayLanguage();
  useSettingsFileSync();
  const navigation = useIslandNavigation();
  const { mode, isTucked, page, setPage, collapseIsland, tuckIsland, revealIsland, minimizeToEdge, openIslandPage, toggleClipboardHistory } = navigation;
  const pluginPages = usePluginPages(page);
  const side = useIslandSide();
  const [storedSettings, setSettings] = useLegacySwitches(useIslandSettings(), { reconcile: true });
  const settings = useResolvedTheme(storedSettings);
  const game = useGameMode(settings, { mode, isTucked, collapseIsland, tuckIsland, revealIsland });
  const notices = useIslandNotices(settings, { mode, isTucked, quiet: game.quiet });
  const { qqNotifications, wechatReminders, qqMail, pluginNotifications, permissionPrompts, hasMessagePreview } = notices;
  useFirstRunGuide(pluginNotifications);
  const demo = useOnboardingDemo();
  const { messageSource, setMessageSource, openMessages } = useMessageView(qqMail.closeReader, openIslandPage);
  const banner = useIslandBanner({ messageNotice: settings.messageNotice, notices, mode, isTucked, quiet: game.quiet, onOpenMessages: openMessages });
  const showsMessage = hasMessagePreview || banner.showing;
  const decor = useIslandDecor();
  const gauges = useCollapsedGauges(mode !== "collapsed" || isTucked || game.quiet);
  const collapsedSlots = useMemo(() => mergeIslandDecor([decor, gauges]), [decor, gauges]);
  useBackgroundUpdateCheck(openUpdateSettings);
  usePluginHostEvents({ mode });

  const copyCard = useClipboardCopyCard(!game.quiet);
  const firstHints = useIslandFirstHints({
    mode,
    isTucked,
    quiet: game.quiet,
    demoActive: demo.active,
  });
  const notch = useIslandNotch();
  const barText = settings.showCollapsedText && !notch;
  const { lines: contributedLines, alerts, popups, style, settled, hints } = useIslandContributed();
  usePluginKeybindings({ mode, page, hasActiveTodo: hints.has("todos.active") });
  useIslandAutoUpdate({ mode, agentsBusy: hints.has("agents.busy") });
  const textWidth = useCollapsedWidth({
    barText,
    noticeText: firstHints.current ? t.island.firstHint[firstHints.current] : null,
    showTitle: settings.showTitle,
    widthExtra: settings.collapsedWidthExtra,
    peeking: banner.hasLinePreview || contributedLines.some((line) => line.drop === true),
    slots: collapsedSlots,
  });
  const collapsedIslandWidth = notchFittedWidth(textWidth, notch, settings.collapsedScale, alerts.size > 0);
  useLegacyStates({
    showsMessage,
    linePreview: banner.hasLinePreview,
    prompting: permissionPrompts.current !== null,
    hold: useTuckHold(settings, { messagesOpen: mode === "expanded" && page === "qq", notices }),
  });
  useIslandTucking({ settings, navigation });


  const clipboard = useClipboardHistory(toggleClipboardHistory);
  const { clipboardHistory } = clipboard;

  const { features, openEnabledPage } = useIslandFeatures({
    settings,
    clipboardEnabled: clipboardHistory.settings.enabled,
    qqEnabled: qqNotifications.snapshot.enabled,
    wechatEnabled: wechatReminders.snapshot.enabled,
    qqMail,
    page,
    messageSource,
    setPage,
    setMessageSource,
    openIslandPage,
    pluginPages: pluginPages.pageIds,
  });
  const messagePanel = useIslandMessagePanel({
    enabled: settings.messageNotice === "panel" && !game.quiet,
    durationMs: settings.messagePanelSeconds * 1000,
    notices, mode, page, openIslandPage, collapseIsland, onOpenMessages: openMessages,
  });
  useLegacyPopups({ maxPanelHeight: settings.maxPanelHeight, arrivalsHeight: messagePanel.arrivals ? messagePanel.height : null });
  const { popup, expandedIslandWidth: popupWidth } = useIslandPopup(
    mode,
    [...popups.values()].some((entry) => entry.open === true),
    null,
    panelIslandWidth(settings.panelWidth, settings.expandedScale),
  );
  const expandedIslandWidth = notchPanelWidth(popupWidth, notch, settings.expandedScale, popup);
  const { resizingHeight, resizing } = useIslandResize(settings, setSettings, popup);
  const pageIslandHeight = getExpandedIslandHeight({ maxPanelHeight: settings.maxPanelHeight, panel: popups.get(page), popup });
  const expandedIslandHeight = (resizingHeight && !popup ? settings.maxPanelHeight : pageIslandHeight) + notchExpandedExtra(notch, settings.expandedScale, popup);
  const look = useMemo(() => (mode !== "collapsed" ? surfaceThemeColors(settings, "panel") : notch ? notchLook(settings) : surfaceThemeColors(settings, "collapsed")), [mode, notch, settings]);
  const accent = useAccentColor(settings);
  const devicePixelRatio = useDevicePixelRatio();
  const reducedMotion = useReducedMotion();
  const { glass, glassStyle } = useIslandGlass({ settings, background: look.islandBackgroundColor, accent, cover: style.tint, mode, isTucked, quiet: game.quiet, reducedMotion });
  const stageStyle = useMemo(
    () => ({
      ...getIslandStageStyle(look, mode, collapsedIslandWidth, expandedIslandHeight, expandedIslandWidth, accent, devicePixelRatio),
      ...islandMotionVariables(settings.islandMotion, mode === "collapsed" ? "close" : "open", reducedMotion),
      ...style.vars,
      ...glassStyle,
    }),
    [collapsedIslandWidth, expandedIslandHeight, expandedIslandWidth, mode, look, accent, devicePixelRatio, settings.islandMotion, reducedMotion, style.vars, glassStyle],
  );

  const { fileShelf, isShelfDropping } = useIslandShelf(settings, navigation);

  const {
    isPositionDetached,
    nativeGlassState,
    minimizeIsland,
    startIslandDrag,
    resetIslandPosition,
  } = useIslandWindow({
    mode,
    isTucked,
    settings,
    setSettings,
    expandedIslandHeight,
    expandedIslandWidth,
    collapsedIslandWidth,
    ready: settled,
    onCollapse: collapseIsland,
  });

  const islandNotice = useIslandNotice({ copyCard, firstHints });
  useNotchDropSync(notch !== null && mode === "collapsed" && !isTucked && hasNotchDrop({
    preview: banner.barPreview, notice: islandNotice !== null, peek: contributedLines.some((line) => line.drop === true),
  }));
  const hoverTucked = useIslandHover({
    settings,
    navigation,
    quiet: game.quiet,
    leadPage: (leadLine(contributedLines, { reserved: true })?.page ?? null) as IslandPage | null,
    openEnabledPage,
  });

  useIslandKeyboard(
    clipboardHistory.settings.enabled && clipboardHistory.settings.shortcutEnabled,
    clipboardHistory.settings.shortcut,
    toggleClipboardHistory,
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
      <IslandRunners mode={mode} page={page} isTucked={isTucked} quiet={game.quiet} barText={barText} setSettings={setSettings} openSettings={openSettingsWindow} takeClickFocus={takeIslandClickFocus} host={islandHost} demo={demo} background={look.islandBackgroundColor} accent={accent} settings={settings} features={features} openIslandPage={openIslandPage} openEnabledPage={openEnabledPage} collapseIsland={collapseIsland} tuckIsland={tuckIsland} revealIsland={revealIsland} />
      <IslandShell
        qqMail={qqMail}
        qqNotifications={qqNotifications}
        wechatReminders={wechatReminders}
        pluginNotifications={pluginNotifications}
        preview={banner.barPreview}
        onOpenMessages={openMessages}
        mode={mode}
        page={page}
        popup={popup}
        resizeLabel={resizing === "collapsed" ? `${collapsedIslandWidth} px` : resizing ? `${expandedIslandWidth} × ${settings.maxPanelHeight}` : null}
        appearanceMode={settings.appearanceMode}
        nativeGlassState={nativeGlassState}
        glass={glass}
        isTucked={isTucked}
        isDetached={isPositionDetached || islandMarginY(settings) > 0}
        side={side}
        showTitle={settings.showTitle}
        showCollapsedText={barText}
        features={features}
        shelfCount={settings.shelfEnabled && settings.shelfShowCount ? fileShelf.items.length : null}
        onOpenPage={openEnabledPage}
        onWindowDragStart={startIslandDrag}
        onCollapse={collapseIsland}
        onResetPosition={resetIslandPosition}
        minimizesToTray={settings.minimizeAction === "tray"}
        onMinimize={settings.minimizeAction === "tray" ? minimizeIsland : minimizeToEdge}
        onOpenTranslator={settings.translationEnabled && settings.translationTarget === "island" ? openTranslator : null}
        onOpenSettings={openSettingsWindow}
        onTuck={tuckIsland}
        onReveal={hoverTucked}
        onPageChange={setPage}
        pageDigitModifiers={settings.pageDigitModifiers}
        hoverSwitchPage={settings.hoverSwitchPage}
        hoverSwitchDelayMs={settings.hoverSwitchDelayMs}
        notice={islandNotice}
        overlay={permissionPrompts.current ? <PluginPermissionPrompt prompts={permissionPrompts} /> : null}
        pluginViews={pluginPages.views}
        onOpenPluginPage={openEnabledPage}
        collapsedSlots={collapsedSlots}
        pluginPageButtons={<PluginPageButtons views={pluginPages.views} page={page} features={features} modifiers={settings.pageDigitModifiers} hoverSwitchPage={settings.hoverSwitchPage} hoverSwitchDelayMs={settings.hoverSwitchDelayMs} onOpen={setPage} />}
      >
        <PluginSlot window="island" name="island.dev/v1" />
        <IslandPages
          page={page}
          mode={mode}
          settings={settings}
          features={features}
          qqMail={qqMail}
          qqNotifications={qqNotifications}
          wechatReminders={wechatReminders}
          messageSource={messageSource}
          messagePanel={messagePanel}
          openMessages={openMessages}
          clipboard={clipboard}
          pluginPages={pluginPages}
          fileShelf={fileShelf}
          isShelfDropping={isShelfDropping}
        />
      </IslandShell>
      <SlotView slot={overlaySlot} props={{ messageBanner: banner.banner && { banner: banner.banner, bannerRef: banner.bannerRef, onOpen: banner.open, onClose: banner.close, onAction: banner.runAction } }} />
      <PluginContextMenus />
    </main>
  );
}
