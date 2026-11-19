import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { AppearanceMode, TuckStyle } from "../../lib/settings/types";
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
import { IslandTuckHint, type TuckHintSettings } from "./IslandTuckHint";
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
  tuckHint?: TuckHintSettings;
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
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const wake = useCallback(() => {
    if (isExpanded) return;
    clearTimer();
    setIsPrewarmed(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setIsPrewarmed(false);
    }, PREWARM_HOLD_MS);
  }, [clearTimer, isExpanded]);

  const leave = useCallback(() => {
    if (isExpanded) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setIsPrewarmed(false);
    }, PREWARM_LEAVE_MS);
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
  page,
  popup = false,
  resizeLabel = null,
  appearanceMode,
  nativeGlassState,
  glass,
  isTucked,
  isDimmed = false,
  tuckStyle = "edge",
  tuckHint,
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
    `island--${page}`,
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
  const showTuckHint = isTucked && tuckStyle === "hidden" && !notch && !isExpanded && tuckHint !== undefined && tuckHint.tuckHintStyle !== "none";

  return (
    <>
      <section
        className={className}
        style={side ? ({ ...ISLAND_OUTLINE_STYLE, "--island-side-column-height": `${sideLayout.height}px` } as CSSProperties) : (ISLAND_OUTLINE_STYLE as CSSProperties)}
        aria-label={collapsedLabel}
        onClick={(event) => {
          if (!isExpanded && event.target === event.currentTarget) {
            onOpenPage(leadPage);
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
            {popup && notch && <NotchPopupBand page={page} heading={contributed.popups.get(page)} agentVisualState={agentVisualState} onCollapse={onCollapse} />}
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
            />
            <div ref={contentRef} className="island__content">
              <IslandPreparingContext.Provider value={preparingContext}>{children}</IslandPreparingContext.Provider>
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
      {showTuckHint && <IslandTuckHint hint={tuckHint} side={side} />}
    </>
  );
}
