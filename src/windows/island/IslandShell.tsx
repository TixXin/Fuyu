import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import type { AppearanceMode, TuckStyle } from "../../lib/settings/types";
import { useTranslation } from "../../i18n";
import { labelLine, leadLine } from "../../features/plugin-kernel/islandContributions";
import { runIslandAction, useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import { isPluginPage, type IslandFeatures } from "./features";
import { IslandCollapsedBar } from "./IslandCollapsedBar";
import { useIslandNotch } from "./notch";
import { NotchPopupBand } from "./NotchPopupBand";
import { IslandHeader } from "./IslandHeader";
import { IconButtonTooltip } from "../../components/IconButtonTooltip";
import type { PluginViewEntry } from "../../features/plugin-views/api";
import type { CollapsedSlots, IslandMode, IslandPage, NativeGlassState } from "./types";
import { useGlassPointer } from "./useGlassPointer";
import { useIslandPreparing } from "./useIslandPreparing";
import { usePageFadeIn } from "./usePageFadeIn";
import { DevWatermark } from "../../components/DevWatermark";
import "./IslandShell.css";
import { IslandGlassLayer } from "./IslandGlassLayer";
import type { IslandGlassView } from "./useIslandGlass";
import { IslandResizeHints } from "./IslandResizeHints";
import { IslandSideHandle } from "./IslandSideHandle";
import { IslandSideColumn, useSideColumnRows } from "./IslandSideColumn";
import { IslandSideBubble } from "./IslandSideBubble";
import { AlertPopup, useActiveAlert } from "./NotchAlert";
import { IslandDragHint } from "./IslandDragHint";
import { sideBubbleTop } from "./sideColumn";
import type { IslandSide } from "./useIslandSide";
import { ISLAND_OUTLINE_STYLE } from "./islandOutline";
import "./IslandOutline.css";

type IslandShellProps = {
  mode: IslandMode;
  page: IslandPage;
  popup?: boolean;
  resizeLabel?: string | null;
  appearanceMode: AppearanceMode;
  nativeGlassState: NativeGlassState;
  glass?: IslandGlassView;
  isTucked: boolean;
  isDimmed?: boolean;
  tuckStyle?: TuckStyle;
  isDetached: boolean;
  side?: IslandSide | null;
  showTitle: boolean;
  showCollapsedText: boolean;
  features: IslandFeatures;
  onOpenPage: (page: IslandPage) => void;
  onWindowDragStart: () => void;
  onCollapse: () => void;
  onResetPosition: () => void;
  minimizesToTray: boolean;
  onMinimize: () => void;
  onOpenTranslator: (() => void) | null;
  notice?: { content: ReactNode; actions: ReactNode } | null;
  onOpenSettings: (section?: "updates") => void;
  onTuck: () => void;
  onReveal: () => void;
  onPageChange: (page: IslandPage) => void;
  pageDigitModifiers: string;
  hoverSwitchPage: boolean;
  hoverSwitchDelayMs: number;
  overlay?: ReactNode;
  pluginPageButtons?: ReactNode;
  pluginViews?: readonly PluginViewEntry[];
  onOpenPluginPage?: (page: `plugin:${string}`) => void;
  collapsedSlots?: CollapsedSlots;
  children: ReactNode;
};

const NO_SOURCES = {};
const IslandPreparingContext = createContext(false);

export function useIslandShellPreparing() {
  return useContext(IslandPreparingContext);
}

export function IslandShell({
  mode,
  page,
  popup = false,
  resizeLabel = null,
  appearanceMode,
  nativeGlassState,
  glass,
  isTucked,
  isDimmed = false,
  tuckStyle = "edge",
  isDetached,
  side = null,
  showTitle,
  showCollapsedText,
  features,
  onOpenPage,
  onWindowDragStart,
  onCollapse,
  onResetPosition,
  minimizesToTray,
  onMinimize,
  onOpenTranslator,
  notice,
  onOpenSettings,
  onTuck,
  onReveal,
  onPageChange,
  pageDigitModifiers,
  hoverSwitchPage,
  hoverSwitchDelayMs,
  overlay,
  pluginPageButtons,
  pluginViews,
  onOpenPluginPage,
  collapsedSlots,
  children,
}: IslandShellProps) {
  const t = useTranslation();
  const notch = useIslandNotch();
  const isExpanded = mode === "expanded";
  const isLiquidGlass = appearanceMode === "liquidGlass";
  const { handleGlassPointerMove, resetGlassPointer } = useGlassPointer(isLiquidGlass && glass?.specular !== false);
  const isPreparing = useIslandPreparing(isExpanded);
  const contentRef = usePageFadeIn<HTMLDivElement>(page, mode);
  const contributed = useIslandContributed();
  const { status } = contributed;
  const agentVisualState = status?.state ?? "idle";
  const agentStatusLabel = status?.label ?? "";
  const sideLayout = useSideColumnRows({ onOpenPage }, collapsedSlots?.gauges ?? []);
  const sideHot = contributed.preview?.hot ?? null;
  const sideHotIndex = sideLayout.shown.findIndex((row) => row.id === sideHot);
  const activeAlert = useActiveAlert();
  const sideBubble = side && !isExpanded && !isTucked && Boolean(contributed.preview || activeAlert);
  const className = [
    "island",
    `island--${mode}`,
    isPluginPage(page) ? "island--plugin" : `island--${page}`,
    `island--appearance-${appearanceMode}`,
    isPreparing && !isExpanded ? "island--preparing" : "",
    isDetached ? "island--detached" : "island--docked",
    isTucked ? "island--tucked" : "",
    isTucked && tuckStyle === "hidden" ? "island--tucked-hidden" : "",
    isDimmed ? "island--dimmed" : "",
    side ? `island--side island--side-${side}` : "",
    popup ? "island--popup" : "",
    isLiquidGlass ? `island--glass-${nativeGlassState}` : "",
    isLiquidGlass && glass ? glass.className : "",
    showTitle ? "" : "island--title-hidden",
  ]
    .filter(Boolean)
    .join(" ");
  const { lines } = contributed;
  const collapsedLabel = (showCollapsedText ? labelLine(lines)?.label : null) ?? t.island.appName;
  const lead = leadLine(lines);
  const leadPage = (lead?.page ?? page) as IslandPage;

  return (
    <section
      className={className}
      style={side ? ({ ...ISLAND_OUTLINE_STYLE, "--island-side-column-height": `${sideLayout.height}px` } as CSSProperties) : (ISLAND_OUTLINE_STYLE as CSSProperties)}
      aria-label={collapsedLabel}
      onClick={(event) => {
        if (!isExpanded && event.target === event.currentTarget) {
          onOpenPage(leadPage);
        }
      }}
      onPointerMove={handleGlassPointerMove}
      onPointerLeave={resetGlassPointer}
      onMouseEnter={() => {
        if (isTucked) {
          onReveal();
        }
      }}
    >
      <div className="island__surface">
        {isLiquidGlass && <IslandGlassLayer glass={glass} />}
        {side && (
          <IslandSideHandle
            label={collapsedLabel}
            agentVisualState={agentVisualState}
            badge={contributed.hints.has("side.badge")}
            onOpen={() => onOpenPage(lead?.handle ? leadPage : page)}
            onWindowDragStart={onWindowDragStart}
          />
        )}
        {side && (
          <IslandSideColumn
            label={collapsedLabel}
            hot={sideBubble ? sideHot : null}
            layout={sideLayout}
            onOpen={() => onOpenPage(page)}
            onWindowDragStart={onWindowDragStart}
          />
        )}
        <IslandCollapsedBar
          pluginViews={pluginViews}
          onOpenPluginPage={onOpenPluginPage}
          slots={collapsedSlots}
          page={page}
          isExpanded={isExpanded}
          isTucked={isTucked}
          showTitle={showTitle}
          showCollapsedText={showCollapsedText}
          collapsedLabel={collapsedLabel}
          agentVisualState={agentVisualState}
          onOpenPage={onOpenPage}
          notice={notice}
          onWindowDragStart={onWindowDragStart}
          onTuck={onTuck}
        />

        <div
          id="island-panel"
          className="island__expanded"
          aria-hidden={!isExpanded}
          inert={!isExpanded}
        >
          <DevWatermark place="panel" />
          {popup && notch && <NotchPopupBand page={page} agentVisualState={agentVisualState} onCollapse={onCollapse} />}
          <IslandHeader
            page={page}
            features={features}
            showTitle={showTitle}
            isDetached={isDetached}
            agentVisualState={agentVisualState}
            agentStatusLabel={agentStatusLabel}
            onPageChange={onPageChange}
            onCollapse={onCollapse}
            onOpenSettings={onOpenSettings}
            onOpenTranslator={onOpenTranslator}
            onResetPosition={onResetPosition}
            minimizesToTray={minimizesToTray}
            onMinimize={onMinimize}
            pageDigitModifiers={pageDigitModifiers}
            hoverSwitchPage={hoverSwitchPage}
            hoverSwitchDelayMs={hoverSwitchDelayMs}
            pluginPageButtons={pluginPageButtons}
          />
          <div ref={contentRef} className="island__content">
            <IslandPreparingContext.Provider value={isPreparing && !isExpanded}>{children}</IslandPreparingContext.Provider>
          </div>
        </div>
        {overlay}
      </div>
      {sideBubble && (
        <IslandSideBubble
          top={sideBubbleTop(sideLayout.height, sideHotIndex >= 0 ? sideLayout.offsets[sideHotIndex] + sideLayout.shown[sideHotIndex].height / 2 : null, 22)}
          summary={contributed.summary}
          previewing={contributed.preview !== null}
          alert={activeAlert && <AlertPopup alert={activeAlert} sources={NO_SOURCES} />}
          onOpenPreview={() => (contributed.preview?.open ? runIslandAction(contributed.preview.open) : onOpenPage(page))}
        />
      )}
      <IslandDragHint />
      <IslandResizeHints isExpanded={isExpanded} popup={popup} sizeLabel={resizeLabel} />
      <IconButtonTooltip />
    </section>
  );
}
