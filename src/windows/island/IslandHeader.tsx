import { useEffect, useRef } from "react";
import { Bot } from "lucide-react";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import { PluginIcon } from "../../features/plugin-kernel/PluginIcon";
import { useTranslation } from "../../i18n";
import { headerDotPages, isPageEnabled, isPageShown, pageShortcutOrder, type IslandFeatures } from "./features";
import { headerSlot, TRAILING_HEADER_IDS, withShortcut, type IslandHeaderContext } from "./slots/header";
import { pageSlot } from "./slots/pageSlot";
import "./slots/builtins";
import type { IslandPage } from "./types";
import { usePanelEditing } from "./custom-panels/panelEditing";
import { usePageHoverSwitch } from "./usePageHoverSwitch";
import { usePagePill } from "./usePagePill";
import { FuyuTextIcon } from "../../components/island-widget/FuyuTextIcon";
import { JellyfishMark } from "../../components/jellyfish/JellyfishMark";
import { FUYU_TEXT_ICON, fuyuPageIconName, JELLYFISH_ICON, pageIconComponent } from "../../components/island-widget/pageIcons";
import { FUYU_PAGE_ID } from "../../lib/settings/customPanels";
import { useHeaderSpotlight } from "./usePluginSpotlight";
import { useWindowDragGesture } from "./useWindowDragGesture";
import { useIslandNotch } from "./notch";
import { useRowOverflow } from "./useRowOverflow";
import { usePageLabel } from "./usePageLabel";
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
  const { builtinLabels, pageLabel } = usePageLabel();
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
  const notch = useIslandNotch();
  const notchHeader = Boolean(notch && !notch.simulated);
  useRowOverflow(dotsRef, true, `${dots.length}|${notchHeader}`);
  const headerRef = useRef<HTMLElement>(null);
  const icons = features.pageLayout?.icons;
  const iconName = (id: string) => (id === FUYU_PAGE_ID ? fuyuPageIconName(icons, id, fuyuTabIcon) : icons?.[id]);
  const pillRef = usePagePill(headerRef, dotsRef, `${page}|${showTitle}|${dots.map((item) => `${item.id}:${iconName(item.id) ?? ""}`).join(",")}`);
  const AgentsIcon = pageIconComponent(iconName("agents"), Bot) ?? Bot;
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
  const renderDot = (item: (typeof dots)[number]) => {
    const target: IslandPage = item.id;
    const Icon = item.icon;
    const label = pageLabel(item);
    const chosen = iconName(target);
    const Custom = chosen === FUYU_TEXT_ICON || chosen === JELLYFISH_ICON ? null : pageIconComponent(chosen, item.external ? undefined : Icon ?? undefined);
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
        {chosen === JELLYFISH_ICON
          ? <JellyfishMark mood="idle" paused height={FUYU_TAB_MARK_HEIGHT} />
          : Custom
            ? <Custom size={15} strokeWidth={1.8} absoluteStrokeWidth />
            : item.external
              ? <PluginIcon icon={Icon} label={label} size={15} strokeWidth={1.8} owner={item.owner} />
              : Icon && <Icon size={Icon === FuyuTextIcon ? 18 : 15} strokeWidth={1.8} absoluteStrokeWidth aria-hidden="true" />}
      </button>
    );
  };

  const leadActions = (
    <SlotView slot={headerSlot} props={buttons} select={(items) => items.filter((item) => !TRAILING_HEADER_IDS.has(item.id) && (item.enabled?.(buttons) ?? true))} />
  );

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
            <AgentsIcon className={agentStatusIconClassName} size={16} strokeWidth={1.8} absoluteStrokeWidth />
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
      {!notchHeader && <div className="window-actions window-actions--lead">{leadActions}</div>}
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
        {notchHeader && leadActions}
        <SlotView slot={headerSlot} props={buttons} select={(items) => items.filter((item) => TRAILING_HEADER_IDS.has(item.id) && (item.enabled?.(buttons) ?? true))} />
      </div>
    </header>
  );
}
