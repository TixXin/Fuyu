import { useCallback, useMemo } from "react";
import { useIslandNotices } from "./useIslandNotices";
import { PluginPermissionPrompt } from "../../features/plugins/PluginPermissionPrompt";
import { PluginContextMenus } from "../../features/plugins/PluginContextMenu";
import { useCalendar } from "../../features/calendar/useCalendar";
import { todoEvents } from "../../features/calendar/todoEvents";
import { IslandPages } from "./IslandPages";
import { useTranslation } from "../../i18n";
import { openSettingsWindow } from "../settings/api";
import { useQuickTranslation } from "../../features/translation/useQuickTranslation";
import { useScreenshotText } from "../../features/screenshot/useScreenshotText";
import { useScreenshotCard } from "../../features/screenshot/useScreenshotCard";
import { ScreenshotNotice, ScreenshotNoticeActions } from "../../features/screenshot/ScreenshotNotice";
import { useScreenshotNotice } from "../../features/screenshot/useScreenshotNotice";
import { useIslandSettings } from "../../features/appearance/useIslandSettings";
import { useClipboardHistory } from "../../features/clipboard/useClipboardHistory";
import { IslandShell } from "./IslandShell";
import { useMediaState } from "../../features/media/useMediaState";
import type { TodoItem } from "../../features/todos/types";
import { useIslandWindow } from "./useIslandWindow";
import { getExpandedIslandHeight } from "./expandedHeight";
import { getIslandStageStyle } from "./stageStyle";
import { useDevicePixelRatio } from "./useDevicePixelRatio";
import { useCollapsedTodo } from "./useCollapsedTodo";
import { useGameMode } from "./useGameMode";
import { useIslandKeyboard } from "./useIslandKeyboard";
import { useIslandFeatures } from "./useIslandFeatures";
import { useIslandAgentAlerts } from "./useIslandAgentAlerts";
import { useIslandAutoUpdate } from "./useIslandAutoUpdate";
import { useIslandAgents } from "./useIslandAgents";
import { useQuotaAlert } from "../../features/agent-status/useQuotaAlert";
import { AgentArrangeButton } from "../../features/agent-status/AgentArrangeButton";
import { useAgentIndicator } from "./useAgentIndicator";
import { useIslandNavigation } from "./useIslandNavigation";
import { useIslandTodos } from "./useIslandTodos";
import { useIslandTucking } from "./useIslandTucking";
import { holdsTuck } from "./tuckHold";
import { useIslandShelf } from "./useIslandShelf";
import { useIslandScreenshot } from "./useIslandScreenshot";
import { useIslandHover } from "./useIslandHover";
import { useIslandTranslation } from "./useIslandTranslation";
import { usePluginPages } from "./usePluginPages";
import { useMessageView } from "./useMessageView";
import { useIslandBanner } from "./useIslandBanner";
import { useIslandMessagePanel } from "./useIslandMessagePanel";
import { useIslandPopup } from "./useIslandPopup";
import { panelIslandWidth } from "./layout";
import { useIslandResize } from "./useIslandResize";
import { useResolvedTheme } from "../../features/appearance/useResolvedTheme";
import { collapsedThemeColors } from "../../features/appearance/themeMode";
import { islandMotionVariables } from "../../features/appearance/islandMotion";
import { useReducedMotion } from "../../features/center-pattern/useReducedMotion";
import { useAccentColor } from "../../features/appearance/useAccentColor";
import { isLightIsland } from "../../utils/color";
import { MessageBanner } from "../../features/messages/banner/MessageBanner";
import { PluginPageButtons } from "./PluginPageButtons";
import { useCollapsedSlots } from "./useCollapsedSlots";
import { useTrayLanguage } from "./useTrayLanguage";
import { useFirstRunGuide } from "./useFirstRunGuide";
import { useSettingsFileSync } from "../../features/settings-backup/useSettingsFileSync";
import { useOnboardingDemo, withDemoMedia } from "./useOnboardingDemo";
import { useIslandLyrics } from "./useIslandLyrics";
import { useIslandFirstHints } from "./useIslandFirstHints";
import { FirstHintActions, FirstHintNotice } from "../../features/first-hints/FirstHintNotice";
import { useIslandSide } from "./useIslandSide";
import { notchFittedWidth, notchLook, useIslandNotch } from "./notch";
import "./IslandApp.css";

const NO_TODOS: TodoItem[] = [];

export function IslandApp() {
  const t = useTranslation();
  useTrayLanguage();
  useSettingsFileSync();
  const navigation = useIslandNavigation();
  const { mode, isTucked, page, setPage, collapseIsland, tuckIsland, revealIsland, minimizeToEdge, openIslandPage, toggleClipboardHistory } = navigation;
  const pluginPages = usePluginPages(page);
  const side = useIslandSide();
  const [storedSettings, setSettings] = useIslandSettings();
  const settings = useResolvedTheme(storedSettings);
  const game = useGameMode(settings, { mode, isTucked, collapseIsland, tuckIsland, revealIsland });
  const notices = useIslandNotices(settings, { mode, isTucked, quiet: game.quiet });
  const { qqNotifications, wechatReminders, qqMail, pluginNotifications, permissionPrompts, hasMessagePreview } = notices;
  useFirstRunGuide(pluginNotifications);
  const demo = useOnboardingDemo();
  const { messageSource, setMessageSource, openMessages } = useMessageView(qqMail.closeReader, openIslandPage);
  const banner = useIslandBanner({ messageNotice: settings.messageNotice, notices, mode, isTucked, quiet: game.quiet, onOpenMessages: openMessages });
  const showsMessage = hasMessagePreview || banner.showing;
  const media = withDemoMedia(useMediaState(settings.musicEnabled), demo);
  const { agentStatus, agentSessions, listedAgentSessions, activeAgentSessionCount, unseenAgentSessions, agentRemoval, agentSession: namedAgent, agentInterjection, agentActivity, agentUsages } =
    useIslandAgents(settings, demo.sessions);
  useIslandAutoUpdate({ mode, sessions: agentSessions });
  const quotaAlert = useQuotaAlert(agentUsages, settings.agentStatusEnabled ? settings.agentQuotaAlertPercent : 0, {
    quiet: game.quiet,
    canPopUp: !game.quiet && mode === "collapsed" && !isTucked,
  });
  const openAgentsPage = useCallback(() => openIslandPage("agents"), [openIslandPage]);
  const collapsedSlots = useCollapsedSlots({
    paused: mode !== "collapsed" || isTucked || game.quiet,
    agents: agentActivity,
    sessions: listedAgentSessions,
    unseen: unseenAgentSessions.keys,
    agentsOn: settings.agentStatusEnabled,
    onOpenAgents: openAgentsPage,
    markLight: settings.agentLightStyle === "mark",
  });
  const { todos, activeTodoId, notebookProps, addTodoOn } = useIslandTodos({ settings, setSettings, mode, page, agentStatus, collapseIsland });

  const screenshotText = useScreenshotText();
  const screenshot = useIslandScreenshot(settings.screenshotEnabled, collapseIsland);
  const screenshotCard = useScreenshotCard(screenshot.settings.cardSeconds);
  const screenshotNotice = useScreenshotNotice(screenshotCard, agentSessions);
  const translationPeek = useQuickTranslation(settings.translationEnabled) ?? screenshotText;
  const firstHints = useIslandFirstHints({
    mode,
    isTucked,
    quiet: game.quiet,
    demoActive: demo.active,
    agentsOn: settings.agentStatusEnabled,
    agentSessionCount: activeAgentSessionCount,
    showsMessage,
    busy: screenshotCard.current !== null || translationPeek !== null || permissionPrompts.current !== null,
  });
  const { lyrics, lyricLine: currentLyric } = useIslandLyrics(settings, media.mediaState, {
    page,
    barShown: mode === "collapsed" && !isTucked && settings.showCollapsedText,
  });
  const agentSession = settings.agentTitleMode === "changes" || (currentLyric && settings.lyricsIslandPriority === "lyrics") ? agentInterjection : namedAgent;
  const lyricLine = agentSession ? null : currentLyric;
  const { collapsedTaskTitle, collapsedTodoCount, collapsedIslandWidth: textWidth } =
    useCollapsedTodo(
      settings.todoEnabled ? todos : NO_TODOS,
      settings.todoEnabled ? activeTodoId : null,
      settings.todoEnabled ? settings : { ...settings, showIdleTodoCount: false },
      mode !== "collapsed" || isTucked || !settings.showCollapsedText || banner.hasLinePreview,
      agentSession?.title ?? null,
      collapsedSlots,
      banner.hasLinePreview || translationPeek !== null,
      lyricLine?.longest ?? null,
      firstHints.current ? t.island.firstHint[firstHints.current] : null,
    );
  const notch = useIslandNotch();
  const collapsedIslandWidth = notchFittedWidth(textWidth, notch, settings.collapsedScale);
  useIslandTucking({
    settings,
    navigation,
    hasMessagePreview: showsMessage,
    hasPermissionPrompt: permissionPrompts.current !== null || screenshotCard.current !== null,
    hasTranslationPeek: Boolean(translationPeek),
    holdTuck: side !== null || holdsTuck(settings, {
      todoInProgress: activeTodoId !== null && todos.some((todo) => todo.id === activeTodoId && !todo.completed),
      agentWaiting: agentSessions.some((session) => session.phase === "waiting"),
      musicPlaying: media.mediaState.playbackStatus === "playing",
    }),
  });


  const clipboard = useClipboardHistory(toggleClipboardHistory);
  const timedTodos = useMemo(() => (settings.todoEnabled ? todoEvents(todos, Date.now(), t.island.todoList) : []), [settings.todoEnabled, t, todos]);
  const calendar = useCalendar(settings.calendarEnabled, settings.calendarRemindMinutes, timedTodos);
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
  const { alertedSession, approvals: agentApprovals, agentCardHeight, alertPopup } = useIslandAgentAlerts({
    sessions: agentSessions,
    unseen: unseenAgentSessions.keys,
    settings,
    enabled: features.agents && !game.quiet,
    mode,
    page,
    openIslandPage,
    collapseIsland,
  });
  const messagePanel = useIslandMessagePanel({
    enabled: settings.messageNotice === "panel" && !game.quiet,
    durationMs: settings.messagePanelSeconds * 1000,
    notices, mode, page, openIslandPage, collapseIsland, onOpenMessages: openMessages,
  });
  const { popup, expandedIslandWidth } = useIslandPopup(
    mode,
    messagePanel.arrivals !== null || alertPopup,
    null,
    panelIslandWidth(settings.panelWidth, settings.expandedScale),
  );
  const { resizingHeight, resizing } = useIslandResize(settings, setSettings, popup);
  const pageIslandHeight = getExpandedIslandHeight({
    page,
    maxPanelHeight: settings.maxPanelHeight,
    agentAlertRowHeight: agentCardHeight,
    messageArrivalsHeight: messagePanel.arrivals ? messagePanel.height : undefined,
    popup,
  });
  const expandedIslandHeight = resizingHeight && !popup ? settings.maxPanelHeight : pageIslandHeight;
  const look = useMemo(() => (mode !== "collapsed" ? settings : notch ? notchLook(settings) : collapsedThemeColors(settings)), [mode, notch, settings]);
  const accent = useAccentColor(settings);
  const devicePixelRatio = useDevicePixelRatio();
  const reducedMotion = useReducedMotion();
  const stageStyle = useMemo(
    () => ({
      ...getIslandStageStyle(look, mode, collapsedIslandWidth, expandedIslandHeight, expandedIslandWidth, accent, devicePixelRatio),
      ...islandMotionVariables(settings.islandMotion, mode === "collapsed" ? "close" : "open", reducedMotion),
    }),
    [collapsedIslandWidth, expandedIslandHeight, expandedIslandWidth, mode, look, accent, devicePixelRatio, settings.islandMotion, reducedMotion],
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
    onCollapse: collapseIsland,
  });

  const hoverTucked = useIslandHover({
    settings,
    navigation,
    quiet: game.quiet,
    hasMessagePreview: showsMessage,
    leadPage: agentSession ? "agents" : lyricLine ? "music" : null,
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

  const { agentVisualState, agentStatusLabel } = useAgentIndicator(agentStatus, settings, activeAgentSessionCount, t);

  const { openTranslator, openTranslationPeek } = useIslandTranslation(
    settings.translationEnabled,
    features.translation,
    mode,
    page,
    openIslandPage,
    collapseIsland,
  );

  return (
    <main className={`stage stage--font-${settings.fontFamily}${isLightIsland(look.islandBackgroundColor) ? " island-light" : ""}`} style={stageStyle}>
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
        isTucked={isTucked}
        isDetached={isPositionDetached || settings.marginY > 0}
        side={side}
        showTitle={settings.showTitle}
        showCollapsedText={settings.showCollapsedText}
        collapsedTaskTitle={collapsedTaskTitle}
        collapsedTodoCount={collapsedTodoCount}
        agentSession={agentSession}
        lyricLine={lyricLine}
        activeAgentSessionCount={activeAgentSessionCount}
        mediaState={media.mediaState}
        agentVisualState={agentVisualState}
        agentStatusLabel={agentStatusLabel}
        features={features}
        shelfCount={settings.shelfEnabled && settings.shelfShowCount ? fileShelf.items.length : null}
        deviceUse={notices.deviceUse}
        levelPopup={notices.levelPopup}
        deviceAlert={notices.deviceAlert}
        quotaAlert={quotaAlert}
        meeting={calendar.upcoming && settings.calendarEnabled ? { upcoming: calendar.upcoming, showTitle: settings.calendarShowTitle } : null}
        onOpenPage={openEnabledPage}
        onWindowDragStart={startIslandDrag}
        onCollapse={collapseIsland}
        onResetPosition={resetIslandPosition}
        minimizesToTray={settings.minimizeAction === "tray"}
        onMinimize={settings.minimizeAction === "tray" ? minimizeIsland : minimizeToEdge}
        onOpenTranslator={settings.translationEnabled && settings.translationTarget === "island" ? openTranslator : null}
        onScreenshot={screenshot.start}
        translationPeek={translationPeek}
        onOpenTranslationPeek={openTranslationPeek}
        onOpenSettings={openSettingsWindow}
        onTuck={tuckIsland}
        onReveal={hoverTucked}
        onPageChange={setPage}
        pageDigitModifiers={settings.pageDigitModifiers}
        hoverSwitchPage={settings.hoverSwitchPage}
        hoverSwitchDelayMs={settings.hoverSwitchDelayMs}
        notice={screenshotNotice.taken
          ? { content: <ScreenshotNotice key={screenshotNotice.taken.path} notice={screenshotNotice} />, actions: <ScreenshotNoticeActions notice={screenshotNotice} /> }
          : firstHints.current
            ? { content: <FirstHintNotice key={firstHints.current} hints={firstHints} />, actions: <FirstHintActions hints={firstHints} onConnectTools={() => openSettingsWindow("agentConnect")} /> }
            : null}
        overlay={permissionPrompts.current ? <PluginPermissionPrompt prompts={permissionPrompts} /> : null}
        pluginViews={pluginPages.views}
        onOpenPluginPage={openEnabledPage}
        collapsedSlots={collapsedSlots}
        pageActions={page === "agents" && (
          <AgentArrangeButton sort={settings.agentSessionSort} group={settings.agentSessionGroup} onChange={(patch) => setSettings({ ...settings, ...patch })} />
        )}
        pluginPageButtons={<PluginPageButtons views={pluginPages.views} page={page} features={features} modifiers={settings.pageDigitModifiers} hoverSwitchPage={settings.hoverSwitchPage} hoverSwitchDelayMs={settings.hoverSwitchDelayMs} onOpen={setPage} />}
      >
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
          media={media}
          lyrics={lyrics}
          clipboard={clipboard}
          agentSessions={listedAgentSessions}
          unseenAgentSessions={unseenAgentSessions}
          agentRemoval={agentRemoval}
          alertedSession={alertedSession}
          agentApprovals={agentApprovals}
          agentUsages={agentUsages}
          pluginPages={pluginPages}
          fileShelf={fileShelf}
          isShelfDropping={isShelfDropping}
          notebookProps={notebookProps}
          addTodoOn={settings.todoEnabled ? addTodoOn : undefined}
          calendar={calendar}
        />
      </IslandShell>
      {banner.banner && (
        <MessageBanner banner={banner.banner} bannerRef={banner.bannerRef} onOpen={banner.open} onClose={banner.close} onAction={banner.runAction} />
      )}
      <PluginContextMenus />
    </main>
  );
}
