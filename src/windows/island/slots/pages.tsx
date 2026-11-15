import type { ComponentType } from "react";
import { TimerPanel } from "../../../features/timer/TimerPanel";
import { MessagesPanel } from "../../../features/messages/Messages";
import { MessageArrivalsPanel } from "../../../features/messages/arrivals/MessageArrivalsPanel";
import { TodoIslandPage } from "../../../features/todos/island/TodoIslandPage";
import { openSettingsWindow } from "../../settings/api";
import { useTranslation } from "../../../i18n";
import { TranslationPanel } from "../../../features/translation/TranslationPanel";
import { AgentSessionsPanel } from "../../../features/agent-status/AgentSessionsPanel";
import { ClipboardHistoryPanel } from "../../../features/clipboard/ClipboardHistoryPanel";
import { MusicPlayerPanel } from "../../../features/media/MusicPlayerPanel";
import { FileShelfPanel } from "../../../features/file-shelf/FileShelfPanel";
import { ScreenshotHistoryPanel } from "../../../features/screenshot/ScreenshotHistoryPanel";
import { CalendarPanel } from "../../../features/calendar/CalendarPanel";
import { getTodoScrollStartRows } from "../layout";
import type { IslandPagesProps } from "../IslandPages";
import type { BuiltinPage } from "../types";
import { BUILTIN_PAGES, pageSlot } from "./pageSlot";

function MessagesPage({ features, qqMail, qqNotifications, wechatReminders, messageSource, messagePanel, openMessages, media }: IslandPagesProps) {
  const { mediaState, runMediaCommand } = media;
  return (
    <div className="message-panel">
      {messagePanel?.arrivals ? (
        <MessageArrivalsPanel arrivals={messagePanel.arrivals} onOpen={messagePanel.open} onAction={messagePanel.runAction} onMeasure={messagePanel.measure} onShowAll={messagePanel.showAll} onClearAll={messagePanel.clearAll} media={{
          playing: mediaState.playbackStatus === "playing",
          onPrevious: () => void runMediaCommand("media_previous"),
          onPlayPause: () => void runMediaCommand("media_play_pause"),
          onNext: () => void runMediaCommand("media_next"),
        }} />
      ) : <MessagesPanel qqMail={qqMail} qqNotifications={qqNotifications} wechatReminders={wechatReminders} source={messageSource} enabledSources={features} onSourceChange={openMessages} onOpenMailSettings={() => openSettingsWindow("mail")} />}
    </div>
  );
}

function MusicPage({ media, settings, lyrics }: IslandPagesProps) {
  const { mediaState, isMediaTrackChanging, mediaCommandError, runMediaCommand } = media;
  return (
    <MusicPlayerPanel
      mediaState={mediaState}
      isTrackChanging={isMediaTrackChanging}
      commandError={mediaCommandError}
      onOpenSettings={() => openSettingsWindow("music")}
      onPlayPause={() => void runMediaCommand("media_play_pause")}
      onNext={() => void runMediaCommand("media_next")}
      onPrevious={() => void runMediaCommand("media_previous")}
      lyricsSettings={settings}
      lyrics={lyrics}
      onAlignLyrics={media.alignPosition}
    />
  );
}

function ClipboardPage({ clipboard, features }: IslandPagesProps) {
  const {
    clipboardHistory,
    copyClipboardHistoryItem,
    toggleClipboardHistoryFavorite,
    updateClipboardHistoryItemNote,
    deleteClipboardHistoryItem,
    clearClipboardHistoryItems,
  } = clipboard;
  const t = useTranslation();
  return (
    <ClipboardHistoryPanel
      snapshot={clipboardHistory}
      onCopyItem={copyClipboardHistoryItem}
      onToggleFavorite={(id) => void toggleClipboardHistoryFavorite(id)}
      onUpdateNote={updateClipboardHistoryItemNote}
      onDeleteItem={(id) => void deleteClipboardHistoryItem(id)}
      onClear={() => void clearClipboardHistoryItems()}
      extraView={features.clipboardScreenshots ? { label: t.screenshot.history.tab, content: <ScreenshotHistoryPanel embedded /> } : undefined}
    />
  );
}

function AgentsPage({ agentSessions, settings, unseenAgentSessions, agentRemoval, alertedSession, agentUsages, agentApprovals }: IslandPagesProps) {
  return <AgentSessionsPanel sessions={agentSessions} view={settings.agentSessionView} sort={settings.agentSessionSort} group={settings.agentSessionGroup} archiveMotion={settings.agentArchiveMotion} cardEffects={settings.agentCardEffects} hostDisplay={settings.agentHostDisplay} showElapsed={settings.agentShowElapsed} showModel={settings.agentShowModel} showActivity={settings.agentShowActivity} unseen={unseenAgentSessions} removal={agentRemoval} reveal={alertedSession} showUsage={settings.agentShowUsage} usages={agentUsages} approvals={agentApprovals} />;
}

function TranslationPage({ mode }: IslandPagesProps) {
  return <TranslationPanel isOpen={mode === "expanded"} onOpenSettings={() => openSettingsWindow("translation")} />;
}

function CalendarPage({ calendar, addTodoOn, notebookProps }: IslandPagesProps) {
  return (
    <CalendarPanel snapshot={calendar.snapshot} now={calendar.now} onRefresh={calendar.refresh} onOpenSettings={() => openSettingsWindow("calendar")}
      todos={addTodoOn && { scheduled: notebookProps.scheduledTodos, onAdd: addTodoOn }} />
  );
}

function ScreenshotsPage() {
  return <ScreenshotHistoryPanel />;
}

function TimerPage({ mode }: IslandPagesProps) {
  return <TimerPanel isOpen={mode === "expanded"} />;
}

function ShelfPage({ fileShelf, isShelfDropping, settings }: IslandPagesProps) {
  return <FileShelfPanel shelf={fileShelf} isDropTarget={isShelfDropping} revealOnDoubleClick={settings.shelfDoubleClick === "reveal"} />;
}

function TodoPage({ notebookProps, settings }: IslandPagesProps) {
  return (
    <TodoIslandPage
      {...notebookProps}
      enableTodoReorder={settings.enableTodoReorder}
      scrollStartRows={getTodoScrollStartRows(settings.maxPanelHeight)}
    />
  );
}

const PANELS: Record<BuiltinPage, ComponentType<IslandPagesProps>> = {
  qq: MessagesPage,
  music: MusicPage,
  clipboard: ClipboardPage,
  agents: AgentsPage,
  translation: TranslationPage,
  calendar: CalendarPage,
  screenshots: ScreenshotsPage,
  timer: TimerPage,
  shelf: ShelfPage,
  todo: TodoPage,
};

for (const page of BUILTIN_PAGES) pageSlot.add({ ...page, component: PANELS[page.id] });
