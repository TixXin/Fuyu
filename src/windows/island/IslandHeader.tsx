import type { ReactNode } from "react";
import { Bot } from "lucide-react";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import { useTranslation } from "../../i18n";
import { headerDotPages, isPageEnabled, type IslandFeatures } from "./features";
import { headerSlot, withShortcut, type IslandHeaderContext } from "./slots/header";
import { pageSlot } from "./slots/pageSlot";
import "./slots/builtins";
import type { HeaderDotPage, IslandPage } from "./types";
import { usePageHoverSwitch } from "./usePageHoverSwitch";
import "./IslandHeader.css";

type IslandHeaderProps = {
  page: IslandPage;
  features: IslandFeatures;
  showTitle: boolean;
  isDetached: boolean;
  agentVisualState: string;
  agentStatusLabel: string;
  onPageChange: (page: IslandPage) => void;
  onCollapse: () => void;
  onOpenSettings: (section?: "updates") => void;
  onOpenTranslator: (() => void) | null;
  onResetPosition: () => void;
  minimizesToTray: boolean;
  onMinimize: () => void;
  pageDigitModifiers: string;
  hoverSwitchPage: boolean;
  hoverSwitchDelayMs: number;
  pluginPageButtons?: ReactNode;
};

export function IslandHeader({
  page,
  features,
  showTitle,
  isDetached,
  agentVisualState,
  agentStatusLabel,
  onPageChange,
  onCollapse,
  onOpenSettings,
  onOpenTranslator,
  onResetPosition,
  minimizesToTray,
  onMinimize,
  pageDigitModifiers,
  hoverSwitchPage,
  hoverSwitchDelayMs,
  pluginPageButtons,
}: IslandHeaderProps) {
  const t = useTranslation();
  const { hints } = useIslandContributed();
  const hoverSwitch = usePageHoverSwitch(hoverSwitchPage, hoverSwitchDelayMs, page, onPageChange);
  const pages = useSlotEntries(pageSlot);
  const dots = headerDotPages(pages, features);
  const buttons: IslandHeaderContext = {
    page,
    features,
    isDetached,
    onOpenSettings,
    onOpenTranslator,
    hints,
    onResetPosition,
    minimizesToTray,
    onMinimize,
    pageDigitModifiers,
    withShortcut: (label, target) => withShortcut({ features, pageDigitModifiers }, label, target),
    isPageEnabled: (target) => isPageEnabled(target, features),
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
        {dots.map((item) => {
          const target = item.id as HeaderDotPage;
          const Icon = item.icon;
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
              {Icon && <Icon size={15} strokeWidth={1.8} absoluteStrokeWidth aria-hidden="true" />}
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
        <SlotView slot={headerSlot} props={buttons} select={(items) => items.filter((item) => item.enabled?.(buttons) ?? true)} />
      </div>
    </header>
  );
}
