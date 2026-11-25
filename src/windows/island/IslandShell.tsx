import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useHoverGrow } from "./useHoverGrow";
import { useShellMotionGuard } from "./useShellMotionGuard";
import type { AppearanceMode, IslandBounce, IslandHover, TuckStyle } from "../../lib/settings/types";
import { useTranslation } from "../../i18n";
import { labelLine, leadLine } from "../../features/plugin-kernel/islandContributions";
import { runIslandAction, useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import type { IslandFeatures } from "./features";
import { IslandCollapsedBar } from "./IslandCollapsedBar";
import { useIslandNotch } from "./notch";
import { NotchPopupBand } from "./NotchPopupBand";
import { IslandHeader } from "./IslandHeader";
import { IconButtonTooltip } from "../../components/IconButtonTooltip";
import type { CollapsedSlots, IslandMode, IslandPage, NativeGlassState } from "./types";
import { useGlassPointer } from "./useGlassPointer";
import { PREWARM_HOLD_MS, PREWARM_LEAVE_MS } from "./panelAwake";
import { useIslandPreparing } from "./useIslandPreparing";
import { usePageSwitchMotion } from "./usePageSwitchMotion";
import { FADE_PAGE_SWITCH, type PageSwitchMotion } from "../../lib/theme/pageSwitch";
import { DevWatermark } from "../../components/DevWatermark";
import "./IslandShell.css";
import "./islandMotionVars.css";
import { IslandGlassLayer } from "./IslandGlassLayer";
import type { IslandGlassView } from "./useIslandGlass";
import { IslandSideHandle } from "./IslandSideHandle";
import { IslandSideColumn, useSideColumnRows } from "./IslandSideColumn";
import { useSidePluginRows } from "./useSidePluginRows";
import { IslandSideBubble } from "./IslandSideBubble";
import { AlertPopup, useActiveAlert } from "./NotchAlert";
import { IslandDragHint } from "./IslandDragHint";
import { IslandTuckHint, type TuckHintSettings } from "./IslandTuckHint";
import { sideBubbleTop } from "./sideColumn";
import type { IslandSide } from "./useIslandSide";
import { ISLAND_OUTLINE_STYLE } from "./islandOutline";
import { isBlankClick } from "./blankClick";
import { usePanelEditing } from "./custom-panels/panelEditing";
import { setPanelAwake } from "../../components/island-widget/panelAwake";
import "./IslandOutline.css";
import { IslandTaskbarHandle, type TaskbarHandleShow } from "./IslandTaskbarHandle";
import { NotchRim, type NotchRimView } from "./notch-rim/NotchRim";
import { NotchRing, type NotchRingView } from "./notch-ring/NotchRing";

export type IslandShellPart = "bar" | "panel";

export type IslandShellProps = {
  mode: IslandMode;
  part?: IslandShellPart;
  page: IslandPage;
  homePage?: IslandPage;
  popup?: boolean;
  appearanceMode: AppearanceMode;
  nativeGlassState: NativeGlassState;
  glass?: IslandGlassView;
  isTucked: boolean;
  isDimmed?: boolean;
  hoverGrow?: IslandHover;
  hoverBounce?: IslandBounce;
  tuckStyle?: TuckStyle;
  tuckLipWidth?: number;
  tuckHint?: TuckHintSettings;
  isDetached: boolean;
  side?: IslandSide | null;
  sideHeight?: number | null;
  showTitle: boolean;
  showCollapsedText: boolean;
  overflowMore?: boolean;
  notchWingMax?: number;
  notchText?: boolean;
  notchRim?: NotchRimView | null;
  notchRing?: NotchRingView | null;
  features: IslandFeatures;
  onOpenPage: (page: IslandPage) => void;
  onWindowDragStart: () => void;
  taskbarHandle?: TaskbarHandleShow | null;
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
  wheelSwitchPage?: boolean;
  preview?: boolean;
  previewWidth?: number;
  previewContent?: ReactNode;
  fuyuTabIcon?: boolean;
  overlay?: ReactNode;
  resize?: ReactNode;
  pageArrows?: ReactNode;
  pageSwitch?: PageSwitchMotion;
  collapsedSlots?: CollapsedSlots;
  children: ReactNode;
};

const NO_SOURCES = {};
const IslandPreparingContext = createContext({ isPreparing: false, isPrewarmed: false });

export function useIslandShellPreparing() {
  return useContext(IslandPreparingContext).isPreparing;
}

export function useIslandShellPrewarmed() {
  return useContext(IslandPreparingContext).isPrewarmed;
}

function useCollapsedPrewarm(isExpanded: boolean) {
  const [isPrewarmed, setIsPrewarmed] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);
  const wake = useCallback(() => {
    if (isExpanded) return;
    clearTimer();
    setIsPrewarmed(true);
    timerRef.current = window.setTimeout(() => { timerRef.current = null; setIsPrewarmed(false); }, PREWARM_HOLD_MS);
  }, [clearTimer, isExpanded]);
  const leave = useCallback(() => {
    if (isExpanded) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => { timerRef.current = null; setIsPrewarmed(false); }, PREWARM_LEAVE_MS);
  }, [clearTimer, isExpanded]);

  if (isExpanded && isPrewarmed) {
    setIsPrewarmed(false);
  }

  useEffect(() => {
    if (isExpanded) {
      clearTimer();
    }
    return clearTimer;
  }, [clearTimer, isExpanded]);

  return { isPrewarmed: isPrewarmed && !isExpanded, wake, leave };
}

export function IslandShell({
  mode,
  part,
  page,
  homePage = page,
  popup = false,
  appearanceMode,
  nativeGlassState,
  glass,
  isTucked,
  isDimmed = false,
  hoverGrow = "near",
  hoverBounce = "regular",
  tuckStyle = "edge",
  tuckLipWidth = 0,
  tuckHint,
  isDetached,
  side = null,
  sideHeight = null,
  showTitle,
  showCollapsedText,
  overflowMore = true,
  notchWingMax,
  notchText = false,
  notchRim = null,
  notchRing = null,
  features,
  onOpenPage,
  onWindowDragStart,
  taskbarHandle,
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
  wheelSwitchPage = false,
  preview = false,
  previewWidth,
  previewContent,
  fuyuTabIcon = false,
  overlay,
  resize,
  pageArrows,
  pageSwitch = FADE_PAGE_SWITCH,
  collapsedSlots,
  children,
}: IslandShellProps) {
  const t = useTranslation();
  const notch = useIslandNotch();
  const isExpanded = mode === "expanded";
  const isLiquidGlass = appearanceMode === "liquidGlass";
  const { handleGlassPointerMove, resetGlassPointer } = useGlassPointer(isLiquidGlass && glass?.specular !== false);
  const isPreparing = useIslandPreparing(isExpanded);
  const prewarm = useCollapsedPrewarm(isExpanded);
  const preparingContext = useMemo(
    () => ({ isPreparing: isPreparing && !isExpanded, isPrewarmed: prewarm.isPrewarmed }),
    [isExpanded, isPreparing, prewarm.isPrewarmed],
  );
  const contentRef = usePageSwitchMotion<HTMLDivElement>(page, mode, pageSwitch, features);
  const shellRef = useRef<HTMLElement | null>(null);
  const contributed = useIslandContributed();
  const { status } = contributed;
  const agentVisualState = status?.state ?? "idle";
  const agentStatusLabel = status?.label ?? "";
  const sidePlugins = useSidePluginRows(side !== null, onOpenPage);
  const sideLayout = useSideColumnRows({ onOpenPage }, collapsedSlots?.gauges ?? [], sideHeight, sidePlugins.rows);
  const sideHot = contributed.preview?.hot ?? null;
  const sideHotIndex = sideLayout.shown.findIndex((row) => row.id === sideHot);
  const activeAlert = useActiveAlert();
  const sideBubble = side && !isExpanded && !isTucked && Boolean(contributed.preview || activeAlert);
  useEffect(() => setPanelAwake(isExpanded), [isExpanded]);
  useShellMotionGuard(shellRef, mode);
  useHoverGrow(shellRef, !isExpanded && !preview && !side && !isTucked && !isDimmed && !(isLiquidGlass && nativeGlassState === "active"), hoverGrow, hoverBounce);
  const narrowTuck = isTucked && !side && !notch && !isExpanded && tuckLipWidth > 0;
  const className = [
    "island",
    `island--${mode}`,
    preview && !isExpanded ? "island--preview" : "",
    `island--${page}`,
    `island--appearance-${appearanceMode}`,
    isPreparing && !isExpanded ? "island--preparing" : "",
    isDetached ? "island--detached" : "island--docked",
    isTucked ? "island--tucked" : "",
    isTucked && tuckStyle === "hidden" ? "island--tucked-hidden" : "",
    narrowTuck ? "island--tuck-narrow" : "",
    isDimmed ? "island--dimmed" : "",
    side ? `island--side island--side-${side}` : "",
    popup ? "island--popup" : "",
    isLiquidGlass ? `island--glass-${nativeGlassState}` : "",
    isLiquidGlass && glass ? glass.className : "",
    showTitle ? "" : "island--title-hidden",
    part ? `island--taskbar-${part}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const { lines } = contributed;
  const collapsedLabel = (showCollapsedText ? labelLine(lines)?.label : null) ?? t.island.appName;
  const lead = leadLine(lines);
  const blankDownRef = useRef<EventTarget | null>(null);
  const editingPanel = usePanelEditing();
  const leadPage = (lead?.page ?? page) as IslandPage;
  const showTuckHint = isTucked && tuckStyle === "hidden" && !notch && !isExpanded && tuckHint !== undefined && tuckHint.tuckHintStyle !== "none";

  return (
    <>
      <section
        ref={shellRef}
        className={className}
        style={{
          ...ISLAND_OUTLINE_STYLE,
          ...(side ? { "--island-side-column-height": `${sideLayout.height}px` } : {}),
          ...(narrowTuck ? { "--island-tuck-width": `${tuckLipWidth}px` } : {}),
          ...(previewWidth ? { "--preview-island-width": `${previewWidth}px` } : {}),
        } as CSSProperties}
        aria-label={collapsedLabel}
        onClick={(event) => {
          if (!isExpanded && event.target === event.currentTarget) {
            onOpenPage(homePage);
          }
        }}
        onPointerEnter={prewarm.wake}
        onPointerDown={prewarm.wake}
        onPointerMove={handleGlassPointerMove}
        onPointerLeave={(event) => {
          resetGlassPointer(event);
          prewarm.leave();
        }}
        onMouseEnter={() => {
          if (isTucked) {
            onReveal();
          }
        }}
      >
        <div className="island__surface">
          {isLiquidGlass && <IslandGlassLayer glass={glass} />}
          {notchRing && notch && !side && !part && !isDetached && !isTucked && <NotchRing view={notchRing} expanded={isExpanded} notch={notch} glow={contributed.glow} playback={contributed.playback} />}
          {side && (
            <IslandSideHandle
              label={collapsedLabel}
              agentVisualState={agentVisualState}
              badge={contributed.hints.has("side.badge")}
              onOpen={() => onOpenPage(lead?.handle ? leadPage : homePage)}
              onWindowDragStart={onWindowDragStart}
            />
          )}
          {side && (
            <IslandSideColumn
              label={collapsedLabel}
              hot={sideBubble ? sideHot : null}
              layout={sideLayout}
              probes={sidePlugins.probes}
              onOpen={() => onOpenPage(homePage)}
              onWindowDragStart={onWindowDragStart}
            />
          )}
          {taskbarHandle && !isExpanded && part !== "panel" && <IslandTaskbarHandle show={taskbarHandle} />}
          {part !== "panel" && <IslandCollapsedBar
            slots={collapsedSlots}
            page={page}
            homePage={homePage}
            isExpanded={isExpanded}
            isTucked={isTucked}
            showTitle={showTitle}
            showCollapsedText={showCollapsedText}
            overflowMore={overflowMore}
            notchWingMax={notchWingMax}
            notchText={notchText}
            collapsedLabel={collapsedLabel}
            agentVisualState={agentVisualState}
            onOpenPage={onOpenPage}
            notice={notice}
            onWindowDragStart={onWindowDragStart}
            onTuck={onTuck}
          />}
          {part !== "panel" && preview && !isExpanded && previewContent}

          {part !== "bar" && <div
            id="island-panel"
            className="island__expanded"
            aria-hidden={!isExpanded}
            inert={!isExpanded}
            onPointerDown={(event) => {
              blankDownRef.current = event.button === 0 ? event.target : null;
            }}
            onClick={(event) => {
              const down = blankDownRef.current;
              blankDownRef.current = null;
              if (!isExpanded || editingPanel !== null || down !== event.target) return;
              if (isBlankClick(event.target, event.currentTarget, event.clientX, event.clientY)) onCollapse();
            }}
          >
            <DevWatermark place="panel" />
            {popup && notch && <NotchPopupBand page={page} heading={contributed.popups.get(page)} agentVisualState={agentVisualState} onCollapse={onCollapse} />}
            <IslandHeader
              page={page}
              isExpanded={isExpanded}
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
              onWindowDragStart={onWindowDragStart}
              minimizesToTray={minimizesToTray}
              onMinimize={onMinimize}
              pageDigitModifiers={pageDigitModifiers}
              hoverSwitchPage={hoverSwitchPage}
              hoverSwitchDelayMs={hoverSwitchDelayMs}
              wheelSwitchPage={wheelSwitchPage}
              fuyuTabIcon={fuyuTabIcon}
            />
            <div ref={contentRef} className="island__content">
              <IslandPreparingContext.Provider value={preparingContext}>{children}</IslandPreparingContext.Provider>
              {pageArrows}
            </div>
          </div>}
          {overlay}
        </div>
        {notchRim && notch && !side && !part && !isDetached && !isTucked && <NotchRim view={notchRim} expanded={isExpanded} glow={contributed.glow} />}
        {sideBubble && (
          <IslandSideBubble
            top={sideBubbleTop(sideLayout.height, sideHotIndex >= 0 ? sideLayout.offsets[sideHotIndex] + sideLayout.shown[sideHotIndex].height / 2 : null, 22)}
            summary={contributed.summary}
            previewing={contributed.preview !== null}
            alert={activeAlert && <AlertPopup alert={activeAlert} sources={NO_SOURCES} />}
            onOpenPreview={() => (contributed.preview?.open ? runIslandAction(contributed.preview.open) : onOpenPage(homePage))}
          />
        )}
        {part === undefined && resize}
        {part !== "panel" && <IslandDragHint />}
        {part !== "panel" && <IconButtonTooltip />}
      </section>
      {showTuckHint && <IslandTuckHint hint={tuckHint} side={side} />}
    </>
  );
}
