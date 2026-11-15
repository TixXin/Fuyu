import type { ReactNode } from "react";
import { Bot, CalendarDays, ClipboardList, Inbox, ListTodo, Music, Images, Timer, type LucideIcon } from "lucide-react";
import type { AgentVisualState } from "../../features/agent-status/status";
import type { MessageSource } from "../../features/messages/messagePreview";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { useTranslation } from "../../i18n";
import { HEADER_DOT_PAGES, type HeaderDotPage, type IslandFeatures } from "./features";
import { headerSlot, withShortcut, type IslandHeaderContext } from "./slots/header";
import type { IslandPage } from "./types";
import { usePageHoverSwitch } from "./usePageHoverSwitch";
import "./IslandHeader.css";

const PAGE_ICONS: Record<HeaderDotPage, LucideIcon> = {
  todo: ListTodo,
  music: Music,
  calendar: CalendarDays,
  clipboard: ClipboardList,
  shelf: Inbox,
  screenshots: Images,
  timer: Timer,
};

type IslandHeaderProps = {
  page: IslandPage;
  features: IslandFeatures;
  showTitle: boolean;
  isDetached: boolean;
  agentVisualState: AgentVisualState;
  agentStatusLabel: string;
  qqNotificationCount: number;
  wechatPending: boolean;
  onPageChange: (page: IslandPage) => void;
  onCollapse: () => void;
  onOpenSettings: (section?: "updates") => void;
  onOpenMessages: (source: MessageSource) => void;
  onOpenTranslator: (() => void) | null;
  onScreenshot?: (() => void) | null;
  onResetPosition: () => void;
  minimizesToTray: boolean;
  onMinimize: () => void;
  pageDigitModifiers: string;
  hoverSwitchPage: boolean;
  hoverSwitchDelayMs: number;
  pluginPageButtons?: ReactNode;
  pageActions?: ReactNode;
};

export function IslandHeader({
  page,
  features,
  showTitle,
  isDetached,
  agentVisualState,
  agentStatusLabel,
  qqNotificationCount,
  wechatPending,
  onPageChange,
  onCollapse,
  onOpenSettings,
  onOpenMessages,
  onOpenTranslator,
  onScreenshot = null,
  onResetPosition,
  minimizesToTray,
  onMinimize,
  pageDigitModifiers,
  hoverSwitchPage,
  hoverSwitchDelayMs,
  pluginPageButtons,
  pageActions,
}: IslandHeaderProps) {
  const t = useTranslation();
  const hoverSwitch = usePageHoverSwitch(hoverSwitchPage, hoverSwitchDelayMs, page, onPageChange);
  const buttons: IslandHeaderContext = {
    page,
    features,
    isDetached,
    qqNotificationCount,
    wechatPending,
    onOpenSettings,
    onOpenMessages,
    onOpenTranslator,
    onScreenshot,
    onResetPosition,
    minimizesToTray,
    onMinimize,
    pageDigitModifiers,
  };
  const pageLabel = (target: HeaderDotPage) => ({
    todo: t.island.todoList,
    music: t.island.music,
    calendar: t.island.calendar,
    clipboard: t.island.clipboardHistory,
    shelf: t.island.shelf,
    screenshots: t.island.screenshots,
    timer: t.island.timer,
  })[target];
  const agentStatusIconClassName = [
    "island__agent-status-icon",
    `island__agent-status-icon--${agentVisualState}`,
  ].join(" ");

  return (
    <header className="island__header">
      <div className="island__header-start">
      <div className="island__title">
        {features.agents ? (
          <button
            className={`island__agent-button${page === "agents" ? " island__agent-button--active" : ""}`}
            type="button"
            aria-label={withShortcut(buttons, `${agentStatusLabel} · ${t.agent.sessions.open}`, "agents")}
            aria-pressed={page === "agents"}
            {...hoverSwitch("agents")}
            onClick={(event) => {
              event.stopPropagation();
              onPageChange("agents");
            }}
          >
            <Bot className={agentStatusIconClassName} size={16} strokeWidth={1.8} absoluteStrokeWidth aria-hidden="true" />
          </button>
        ) : (
          <Bot
            className={agentStatusIconClassName}
            size={16}
            strokeWidth={1.5}
            absoluteStrokeWidth
            aria-label={agentStatusLabel}
          />
        )}
        {showTitle && <span>{t.island.appName}</span>}
      </div>

      <div className="editor-dots" aria-label={t.island.editor}>
        {HEADER_DOT_PAGES.filter((target) => features[target]).map((target) => {
          const Icon = PAGE_ICONS[target];
          return (
            <button
              key={target}
              className={`dot-button dot-button--${target}${page === target ? " dot-button--active" : ""}`}
              type="button"
              aria-label={withShortcut(buttons, pageLabel(target), target)}
              aria-pressed={page === target}
              {...hoverSwitch(target)}
              onClick={(event) => {
                event.stopPropagation();
                onPageChange(target);
              }}
            >
              <Icon size={15} strokeWidth={1.8} absoluteStrokeWidth aria-hidden="true" />
            </button>
          );
        })}
        {pluginPageButtons}
      </div>
      </div>

      <button
        className="island__collapse-target"
        type="button"
        aria-label={t.island.collapseIsland}
        data-tooltip=""
        data-window-drag="false"
        onClick={onCollapse}
      />

      <div className="window-actions">
        {pageActions}
        <SlotView slot={headerSlot} props={buttons} select={(items) => items.filter((item) => item.enabled?.(buttons) ?? true)} />
      </div>
    </header>
  );
}
