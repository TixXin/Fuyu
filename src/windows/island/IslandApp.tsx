import { useCallback, useMemo } from "react";
// First: the message panels it loads bring CSS that must come before the page panels' and the shell's.
import { useIslandNotices } from "./useIslandNotices";
import { PluginPermissionPrompt } from "../../features/plugins/PluginPermissionPrompt";
import { PluginContextMenus } from "../../features/plugins/PluginContextMenu";
// The page panels; before IslandShell so their CSS keeps its place in the cascade.
import { useCalendar } from "../../features/calendar/useCalendar";
import { todoEvents } from "../../features/calendar/todoEvents";
import { IslandPages } from "./IslandPages";
import { useTranslation } from "../../i18n";
import { openSettingsWindow } from "../settings/api";
import { useQuickTranslation } from "../../features/translation/useQuickTranslation";
import { useIslandSettings } from "../../features/appearance/useIslandSettings";
import { useClipboardHistory } from "../../features/clipboard/useClipboardHistory";
// Imported after the page panels so its CSS keeps its place in the cascade.
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
import { useAccentColor } from "../../features/appearance/useAccentColor";
import { isLightIsland } from "../../utils/color";
import { MessageBanner } from "../../features/messages/banner/MessageBanner";
import { PluginPageButtons } from "./PluginPageButtons";
import { useCollapsedSlots } from "./useCollapsedSlots";
import { useTrayLanguage } from "./useTrayLanguage";
import { useFirstRunGuide } from "./useFirstRunGuide";
import { useIslandLyrics } from "./useIslandLyrics";
// Must stay the last import: IslandApp.css overrides the feature styles above.
import "./IslandApp.css";

// Stands in for the todo list while todos are switched off, so the collapsed island shows none.
const NO_TODOS: TodoItem[] = [];

/**
 * The island window: puts the feature hooks together and hands their state to the shell and the
 * page panels. Each concern's wiring lives in its own use* hook next to this file; add new wiring
 * there rather than here, so parallel changes do not all meet in this file.
 */
export function IslandApp() {
  const t = useTranslation();
  useTrayLanguage();
  // Before useIslandSettings saves the settings, which marks the install as having run.
  useFirstRunGuide();
  const navigation = useIslandNavigation();
  const { mode, isTucked, page, setPage, collapseIsland, tuckIsland, revealIsland, minimizeToEdge, openIslandPage, toggleClipboardHistory } = navigation;
  const pluginPages = usePluginPages(page);
  const [storedSettings, setSettings] = useIslandSettings();
  // The colours of the dark or light set the theme uses now (C31, C33.3).
  const settings = useResolvedTheme(storedSettings);
  // Quiet while a full-screen app (usually a game) is in front, if game mode asks for it.
  const game = useGameMode(settings, { mode, isTucked, collapseIsland, tuckIsland, revealIsland });
  const notices = useIslandNotices(settings, { mode, isTucked, quiet: game.quiet });
  const { qqNotifications, wechatReminders, qqMail, pluginNotifications, permissionPrompts, hasMessagePreview } = notices;
  const { messageSource, setMessageSource, openMessages } = useMessageView(qqMail.closeReader, openIslandPage);
  const banner = useIslandBanner({ messageNotice: settings.messageNotice, notices, mode, isTucked, quiet: game.quiet, onOpenMessages: openMessages });
  // A banner holds the island like a preview line does, but leaves the bar's summary in place.
  const showsMessage = hasMessagePreview || banner.showing;
  const media = useMediaState(settings.musicEnabled);
  const { agentStatus, agentSessions, listedAgentSessions, activeAgentSessionCount, unseenAgentSessions, agentRemoval, agentSession: namedAgent, agentInterjection, agentActivity, agentUsages } =
    useIslandAgents(settings);
  // Downloads updates in the background and installs them when idle (D18).
  useIslandAutoUpdate({ mode, sessions: agentSessions });
  const quotaAlert = useQuotaAlert(agentUsages, settings.agentStatusEnabled ? settings.agentQuotaAlertPercent : 0, {
    quiet: game.quiet,
    canPopUp: !game.quiet && mode === "collapsed" && !isTucked,
  });
  const openAgentsPage = useCallback(() => openIslandPage("agents"), [openIslandPage]);
  const collapsedSlots = useCollapsedSlots({
    paused: mode !== "collapsed" || isTucked || game.quiet,
    agents: agentActivity,
    // The Agent page's list, so the ring leaves out what the page hides (quit sessions, say).
    sessions: listedAgentSessions,
    unseen: unseenAgentSessions.keys,
    agentsOn: settings.agentStatusEnabled,
    onOpenAgents: openAgentsPage,
    markLight: settings.agentLightStyle === "mark",
  });
  const { todos, activeTodoId, notebookProps, addTodoOn } = useIslandTodos({ settings, mode, page, agentStatus, collapseIsland });

  const translationPeek = useQuickTranslation(settings.translationEnabled);
  const { lyrics, lyricLine: currentLyric } = useIslandLyrics(settings, media.mediaState, {
    page,
    barShown: mode === "collapsed" && !isTucked && settings.showCollapsedText,
  });
  // While a line is sung, lyrics first: an agent only for a moment when its session changes, or
  // while it waits on the user. Agents first: the lyric line only while no agent is named.
  const agentSession = settings.agentTitleMode === "changes" || (currentLyric && settings.lyricsIslandPriority === "lyrics") ? agentInterjection : namedAgent;
  const lyricLine = agentSession ? null : currentLyric;
  const { collapsedTaskTitle, collapsedTodoCount, collapsedIslandWidth } =
    useCollapsedTodo(
      settings.todoEnabled ? todos : NO_TODOS,
      settings.todoEnabled ? activeTodoId : null,
      settings.todoEnabled ? settings : { ...settings, showIdleTodoCount: false },
      mode !== "collapsed" || isTucked || !settings.showCollapsedText || banner.hasLinePreview,
      agentSession?.title ?? null,
      collapsedSlots,
      banner.hasLinePreview || translationPeek !== null,
      lyricLine?.longest ?? null,
    );
  useIslandTucking({
    settings,
    navigation,
    hasMessagePreview: showsMessage,
    hasPermissionPrompt: permissionPrompts.current !== null,
    hasTranslationPeek: Boolean(translationPeek),
    holdTuck: holdsTuck(settings, {
      todoInProgress: activeTodoId !== null && todos.some((todo) => todo.id === activeTodoId && !todo.completed),
      agentWaiting: agentSessions.some((session) => session.phase === "waiting"),
      musicPlaying: media.mediaState.playbackStatus === "playing",
    }),
  });


  const clipboard = useClipboardHistory(toggleClipboardHistory);
  // Todos starting with a time ("15:00 周会") count down like meetings, with no calendar needed.
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
    // One width for every page (C27); a popup is narrower.
    null,
    panelIslandWidth(settings.panelWidth, settings.expandedScale),
  );
  // Alt + dragging the panel's edges (C25); a height drag shows the panel at the height being set.
  const resizingHeight = useIslandResize(settings, setSettings);
  const pageIslandHeight = getExpandedIslandHeight({
    page,
    maxPanelHeight: settings.maxPanelHeight,
    agentAlertRowHeight: agentCardHeight,
    messageArrivalsHeight: messagePanel.arrivals ? messagePanel.height : undefined,
    popup,
  });
  const expandedIslandHeight = resizingHeight && !popup ? settings.maxPanelHeight : pageIslandHeight;
  // The colours the island shows now: a light island may stay dark while collapsed (C33.2).
  const look = useMemo(() => (mode === "collapsed" ? collapsedThemeColors(settings) : settings), [mode, settings]);
  const accent = useAccentColor(settings);
  const devicePixelRatio = useDevicePixelRatio();
  const stageStyle = useMemo(
    () => getIslandStageStyle(look, mode, collapsedIslandWidth, expandedIslandHeight, expandedIslandWidth, accent, devicePixelRatio),
    [collapsedIslandWidth, expandedIslandHeight, expandedIslandWidth, mode, look, accent, devicePixelRatio],
  );

  const { fileShelf, isShelfDropping } = useIslandShelf(settings, navigation);
  useIslandScreenshot(settings.screenshotEnabled);

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
        appearanceMode={settings.appearanceMode}
        nativeGlassState={nativeGlassState}
        isTucked={isTucked}
        isDetached={isPositionDetached || settings.marginY > 0}
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
        // In its own window, translation opens from its shortcut or the tray; the button is for the page.
        onOpenTranslator={settings.translationEnabled && settings.translationTarget === "island" ? openTranslator : null}
        translationPeek={translationPeek}
        onOpenTranslationPeek={openTranslationPeek}
        onOpenSettings={openSettingsWindow}
        onTuck={tuckIsland}
        onReveal={hoverTucked}
        onPageChange={setPage}
        pageDigitModifiers={settings.pageDigitModifiers}
        hoverSwitchPage={settings.hoverSwitchPage}
        hoverSwitchDelayMs={settings.hoverSwitchDelayMs}
        overlay={<PluginPermissionPrompt prompts={permissionPrompts} />}
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
