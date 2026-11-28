import { useCallback, useRef, type WheelEvent } from "react";
import { Bot } from "lucide-react";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import { PluginIcon } from "../../features/plugin-kernel/PluginIcon";
import { useTranslation } from "../../i18n";
import { shortcutLabel } from "../../lib/shortcut/shortcut";
import { headerDotPages, isPageEnabled, isPageShown, pageShortcutLabel, pageShortcutOrder, type IslandFeatures } from "./features";
import { createWheelPageSwitchTracker, normalizeWheelDelta, stepPageIndex } from "./wheelPageSwitch";
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
import { useHeaderTabFit } from "./useHeaderTabFit";
import { usePageLabel } from "./usePageLabel";
import { NotchHeaderMore, type NotchHeaderMoreItem } from "./NotchHeaderMore";
import { useNotchHeaderSplit } from "./useNotchHeaderSplit";
import "./IslandHeader.css";

const FUYU_TAB_MARK_HEIGHT = 15;
const INTERACTIVE = "button, a, input, textarea, select, label, [role='button'], [contenteditable='true']";

type IslandHeaderProps = {
  page: IslandPage;
  isExpanded?: boolean;
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
  wheelSwitchPage?: boolean;
  fuyuTabIcon?: boolean;
  onWindowDragStart: () => void;
};

export function IslandHeader({
  page,
  isExpanded = true,
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
  wheelSwitchPage = false,
  fuyuTabIcon = false,
  onWindowDragStart,
}: IslandHeaderProps) {
  const t = useTranslation();
  const { builtinLabels, pageLabel } = usePageLabel();
  const { hints } = useIslandContributed();
  const editing = usePanelEditing() !== null;
  const hoverSwitch = usePageHoverSwitch(hoverSwitchPage && !editing && isExpanded, hoverSwitchDelayMs, page, onPageChange);
  const wheelTrackerRef = useRef<ReturnType<typeof createWheelPageSwitchTracker> | null>(null);
  if (wheelTrackerRef.current === null) wheelTrackerRef.current = createWheelPageSwitchTracker();
  const spotlightOf = useHeaderSpotlight();
  const { didDragRef, prepareWindowDrag, cancelWindowDrag } = useWindowDragGesture(false, onWindowDragStart);
  const pages = useSlotEntries(pageSlot);
  const dots = headerDotPages(pages, features);
  const shortcutOrder = pageShortcutOrder(features);
  const agentsShown = isPageShown("agents", features);
  const agentsAt = agentsShown ? shortcutOrder.indexOf("agents") : -1;
  const leading = dots.filter((item) => {
    const at = shortcutOrder.indexOf(item.id as IslandPage);
    return at >= 0 && at < agentsAt;
  });
  const trailing = dots.filter((item) => !leading.includes(item));
  const startRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const leadActionsRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const moreElRef = useRef<HTMLButtonElement | null>(null);
  const setMoreEl = useCallback((element: HTMLButtonElement | null) => {
    moreElRef.current = element;
  }, []);
  const notch = useIslandNotch();
  const notchHeader = Boolean(notch && !notch.simulated);
  const headerRef = useRef<HTMLElement>(null);
  const icons = features.pageLayout?.icons;
  const iconName = (id: string) => (id === FUYU_PAGE_ID ? fuyuPageIconName(icons, id, fuyuTabIcon) : icons?.[id]);
  const iconKey = dots.map((item) => `${item.id}:${iconName(item.id) ?? ""}`).join(",");
  const tabs = [
    ...leading.map((item) => ({ kind: "dot" as const, id: item.id, item })),
    ...(agentsShown ? [{ kind: "agents" as const, id: "agents" as IslandPage }] : []),
    ...trailing.map((item) => ({ kind: "dot" as const, id: item.id, item })),
  ];
  const tabMetrics = tabs.map((entry) => {
    if (entry.kind === "agents") return { id: entry.id, textIcon: false };
    const chosen = iconName(entry.id);
    const Custom = chosen === FUYU_TEXT_ICON || chosen === JELLYFISH_ICON ? null : pageIconComponent(chosen, entry.item.external ? undefined : entry.item.icon ?? undefined);
    const textIcon = chosen === FUYU_TEXT_ICON || (!Custom && !entry.item.external && entry.item.icon === FuyuTextIcon);
    return { id: entry.id, textIcon };
  });
  const notchVisibleCount = useNotchHeaderSplit(notchHeader, startRef, titleRef, dotsRef, moreElRef, tabMetrics, iconKey);
  const fitRefs = { header: headerRef, title: titleRef, row: dotsRef, more: moreElRef, actions: [leadActionsRef, actionsRef] };
  const fitKey = [iconKey, showTitle, t.island.appName, ...dots.map((item) => pageLabel(item))].join("|");
  const fit = useHeaderTabFit(!notchHeader, fitRefs, tabMetrics, leading.length + (agentsShown ? 1 : 0), fitKey);
  const visibleCount = notchHeader ? notchVisibleCount : fit.visible;
  const compactTabs = !notchHeader && fit.compact;
  const visibleTabs = tabs.slice(0, visibleCount);
  const visibleIds = new Set<string>(visibleTabs.map((entry) => entry.id));
  const hiddenTabs = tabs.slice(visibleCount);
  const pillRef = usePagePill(headerRef, dotsRef, `${page}|${showTitle}|${iconKey}|${compactTabs}|${notchHeader ? 0 : hiddenTabs.length}`);
  const AgentsIcon = pageIconComponent(iconName("agents"), Bot) ?? Bot;
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
  const renderDotIcon = (item: (typeof dots)[number], inMenu = false, iconOnly = inMenu) => {
    const target: IslandPage = item.id;
    const Icon = item.icon;
    const label = pageLabel(item);
    const chosen = iconName(target);
    const Custom = chosen === FUYU_TEXT_ICON || chosen === JELLYFISH_ICON ? null : pageIconComponent(chosen, item.external ? undefined : Icon ?? undefined);
    if (chosen === JELLYFISH_ICON || (iconOnly && (chosen === FUYU_TEXT_ICON || (!Custom && !item.external && Icon === FuyuTextIcon)))) {
      return <JellyfishMark mood="idle" paused height={inMenu ? 14 : FUYU_TAB_MARK_HEIGHT} />;
    }
    if (Custom) return <Custom size={15} strokeWidth={1.8} absoluteStrokeWidth />;
    if (item.external) return <PluginIcon icon={Icon} label={label} size={15} strokeWidth={1.8} owner={item.owner} />;
    return Icon ? <Icon size={Icon === FuyuTextIcon ? 18 : 15} strokeWidth={1.8} absoluteStrokeWidth aria-hidden="true" /> : null;
  };
  const renderDot = (item: (typeof dots)[number]) => {
    const target: IslandPage = item.id;
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
        {renderDotIcon(item, false, compactTabs)}
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

  const renderAgentsButton = () => (
    <button
      key="agents"
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
  );

  const agentsPage = pages.find((item) => item.id === "agents");
  const hiddenMoreItems: NotchHeaderMoreItem[] = hiddenTabs.map((entry) => {
    const shortcut = pageShortcutLabel(features, entry.id, pageDigitModifiers);
    const formattedShortcut = shortcut ? shortcutLabel(shortcut) : null;
    if (entry.kind === "agents") {
      return {
        id: "agents",
        label: agentsPage ? pageLabel(agentsPage) : "AI Agent",
        shortcut: formattedShortcut,
        icon: <AgentsIcon className={agentStatusIconClassName} size={15} strokeWidth={1.8} absoluteStrokeWidth />,
        active: page === "agents",
      };
    }
    return {
      id: entry.item.id,
      label: pageLabel(entry.item),
      shortcut: formattedShortcut,
      icon: renderDotIcon(entry.item, true),
      active: page === entry.item.id,
      spotlight: spotlightOf(entry.item),
    };
  });

  const hasStaticNotchTitle = !agentsShown || showTitle;

  const handleHeaderWheel = (event: WheelEvent<HTMLElement>) => {
    if (!wheelSwitchPage || !isExpanded || editing || shortcutOrder.length <= 1) return;
    const step = wheelTrackerRef.current?.feed(normalizeWheelDelta(event.deltaY, event.deltaX, event.deltaMode), performance.now()) ?? 0;
    if (step === 0) return;
    const currentIndex = shortcutOrder.indexOf(page);
    if (currentIndex < 0) return;
    const nextIndex = stepPageIndex(currentIndex, step, shortcutOrder.length);
    if (nextIndex !== currentIndex) {
      event.preventDefault();
      event.stopPropagation();
      onPageChange(shortcutOrder[nextIndex]);
    }
  };

  return (
    <header
      ref={headerRef}
      className="island__header"
      onWheel={handleHeaderWheel}
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
      <div ref={startRef} className="island__header-start">
      {notchHeader ? (
        <>
          {hasStaticNotchTitle && (
            <div ref={titleRef} className="island__title">
              {!agentsShown && (
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
          )}
          <div ref={dotsRef} className="editor-dots" aria-label={t.island.editor}>
            {visibleTabs.map((entry) => (entry.kind === "agents" ? renderAgentsButton() : renderDot(entry.item)))}
          </div>
          {hiddenMoreItems.length > 0 && (
            <NotchHeaderMore items={hiddenMoreItems} page={page} isExpanded={isExpanded} buttonRef={setMoreEl} onSelect={onPageChange} />
          )}
        </>
      ) : (
        <>
          <div ref={titleRef} className="island__title">
            {leading.filter((item) => visibleIds.has(item.id)).map(renderDot)}
            {agentsShown ? visibleIds.has("agents") && renderAgentsButton() : (
              <Bot
                className={agentStatusIconClassName}
                size={16}
                strokeWidth={1.5}
                absoluteStrokeWidth
                aria-label={agentStatusLabel}
              />
            )}
            {showTitle && !compactTabs && <span>{t.island.appName}</span>}
          </div>

          <div ref={dotsRef} className="editor-dots" aria-label={t.island.editor}>
            {trailing.filter((item) => visibleIds.has(item.id)).map(renderDot)}
            {hiddenMoreItems.length > 0 && (
              <NotchHeaderMore items={hiddenMoreItems} page={page} isExpanded={isExpanded} buttonRef={setMoreEl} onSelect={onPageChange} />
            )}
          </div>
          <div ref={leadActionsRef} className="window-actions window-actions--lead">{leadActions}</div>
        </>
      )}
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

      <div ref={actionsRef} className="window-actions">
        {notchHeader && leadActions}
        <SlotView slot={headerSlot} props={buttons} select={(items) => items.filter((item) => TRAILING_HEADER_IDS.has(item.id) && (item.enabled?.(buttons) ?? true))} />
      </div>
    </header>
  );
}
