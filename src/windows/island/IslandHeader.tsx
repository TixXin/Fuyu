import { useEffect, useRef } from "react";
import { Bot } from "lucide-react";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import { PluginIcon } from "../../features/plugin-kernel/PluginIcon";
import { usePluginNames } from "../../features/plugin-kernel/pluginNames";
import { localizedTitle, packageLabel } from "../../features/plugin-kernel/slotTitle";
import { useLocale, useTranslation } from "../../i18n";
import { headerDotPages, isPageEnabled, isPageShown, pageShortcutOrder, type IslandFeatures } from "./features";
import { headerSlot, TRAILING_HEADER_IDS, withShortcut, type IslandHeaderContext } from "./slots/header";
import { pageSlot } from "./slots/pageSlot";
import "./slots/builtins";
import type { HeaderDotPage, IslandPage } from "./types";
import { usePanelEditing } from "./custom-panels/panelEditing";
import { usePageHoverSwitch } from "./usePageHoverSwitch";
import { usePagePill } from "./usePagePill";
import { FuyuTextIcon } from "../../components/island-widget/FuyuTextIcon";
import { JellyfishMark } from "../../components/jellyfish/JellyfishMark";
import { useHeaderSpotlight } from "./usePluginSpotlight";
import { useWindowDragGesture } from "./useWindowDragGesture";
import "./IslandHeader.css";

const FUYU_TAB_MARK_HEIGHT = 15;
const INTERACTIVE = "button, a, input, textarea, select, label, [role='button'], [contenteditable='true']";

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
  fuyuTabIcon?: boolean;
  onWindowDragStart: () => void;
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
  fuyuTabIcon = false,
  onWindowDragStart,
}: IslandHeaderProps) {
  const t = useTranslation();
  const { locale } = useLocale();
  const pluginNames = usePluginNames();
  const { hints } = useIslandContributed();
  const editing = usePanelEditing() !== null;
  const hoverSwitch = usePageHoverSwitch(hoverSwitchPage && !editing, hoverSwitchDelayMs, page, onPageChange);
  const spotlightOf = useHeaderSpotlight();
  const { didDragRef, prepareWindowDrag, cancelWindowDrag } = useWindowDragGesture(false, onWindowDragStart);
  const pages = useSlotEntries(pageSlot);
  const dots = headerDotPages(pages, features);
  const shortcutOrder = pageShortcutOrder(features);
  const agentsAt = isPageShown("agents", features) ? shortcutOrder.indexOf("agents") : -1;
  const leading = dots.filter((item) => {
    const at = shortcutOrder.indexOf(item.id as IslandPage);
    return at >= 0 && at < agentsAt;
  });
  const trailing = dots.filter((item) => !leading.includes(item));
  const dotsRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const pillRef = usePagePill(headerRef, dotsRef, `${page}|${showTitle}|${fuyuTabIcon}|${dots.map((item) => item.id).join(",")}`);
  useEffect(() => {
    const row = dotsRef.current;
    const active = row?.querySelector<HTMLElement>(".dot-button--active");
    if (!row || !active || row.scrollWidth <= row.clientWidth) return;
    const left = active.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft) row.scrollLeft = left;
    else if (left + active.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollLeft = left + active.offsetWidth - row.clientWidth;
  }, [page, dots.length]);
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
    isPageShown: (target) => isPageShown(target, features),
  };
  const builtinLabels: Record<HeaderDotPage, string> = {
    todo: t.island.todoList,
    music: t.island.music,
    calendar: t.island.calendar,
    clipboard: t.island.clipboardHistory,
    shelf: t.island.shelf,
    screenshots: t.island.screenshots,
    timer: t.island.timer,
  };
  const pageLabel = (item: (typeof dots)[number]) =>
    (item.external ? null : builtinLabels[item.id as HeaderDotPage])
    ?? localizedTitle(item.title, locale)
    ?? localizedTitle(pluginNames.get(item.owner), locale)
    ?? packageLabel(item.owner === "builtin" ? item.id : item.owner);
  const renderDot = (item: (typeof dots)[number]) => {
    const target: IslandPage = item.id;
    const Icon = item.icon;
    const label = pageLabel(item);
    const named = item.external || !(target in builtinLabels);
    const kind = item.external ? "dot-button--plugin" : named ? "dot-button--custom" : `dot-button--${target}`;
    return (
      <button
        key={target}
        className={`dot-button ${kind}${page === target ? " dot-button--active" : ""}`}
        type="button"
        data-page={named ? target : undefined}
        {...spotlightOf(item)}
        aria-label={withShortcut(buttons, label, target)}
        aria-pressed={page === target}
        {...hoverSwitch(target)}
        onClick={(event) => {
          event.stopPropagation();
          onPageChange(target);
        }}
      >
        {item.external
          ? <PluginIcon icon={Icon} label={label} size={15} strokeWidth={1.8} owner={item.owner} />
          : Icon === FuyuTextIcon && fuyuTabIcon
            ? <JellyfishMark mood="idle" paused height={FUYU_TAB_MARK_HEIGHT} />
            : Icon && <Icon size={Icon === FuyuTextIcon ? 18 : 15} strokeWidth={1.8} absoluteStrokeWidth aria-hidden="true" />}
      </button>
    );
  };

  const agentStatusIconClassName = [
    "island__agent-status-icon",
    `island__agent-status-icon--${agentVisualState}`,
  ].join(" ");

  return (
    <header
      ref={headerRef}
      className="island__header"
      onPointerDown={prepareWindowDrag}
      onPointerUp={cancelWindowDrag}
      onPointerCancel={cancelWindowDrag}
      onClick={(event) => {
        if (didDragRef.current) return;
        if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return;
        onCollapse();
      }}
    >
      <span ref={pillRef} className="island__page-pill" aria-hidden="true" />
      <div className="island__header-start">
      <div className="island__title">
        {leading.map(renderDot)}
        {isPageShown("agents", features) ? (
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

      <div ref={dotsRef} className="editor-dots" aria-label={t.island.editor}>
        {trailing.map(renderDot)}
      </div>
      <div className="window-actions window-actions--lead">
        <SlotView slot={headerSlot} props={buttons} select={(items) => items.filter((item) => !TRAILING_HEADER_IDS.has(item.id) && (item.enabled?.(buttons) ?? true))} />
      </div>
      </div>

      <button
        className="island__collapse-target"
        type="button"
        aria-label={t.island.collapseIsland}
        data-tooltip=""
        onClick={(event) => {
          event.stopPropagation();
          if (event.detail > 0 && didDragRef.current) return;
          onCollapse();
        }}
      />

      <div className="window-actions">
        <SlotView slot={headerSlot} props={buttons} select={(items) => items.filter((item) => TRAILING_HEADER_IDS.has(item.id) && (item.enabled?.(buttons) ?? true))} />
      </div>
    </header>
  );
}
