import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { JellyfishStyleContext } from "../../components/jellyfish/jellyfishStyleContext";
import { pluginRuntime } from "../../features/plugin-kernel/runtime";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import { useTranslation } from "../../i18n";
import { sideDockEnabledSides, type SideDockEdge } from "../../lib/settings/sideDocks";
import { useIslandPages } from "../../lib/settings/useIslandPages";
import { useIslandSettings } from "../../lib/settings/useIslandSettings";
import { useSideDocks } from "../../lib/settings/useSideDocks";
import { nextCarouselTurn, pageSwitchSpeed, resolvePageSwitch } from "../../lib/theme/pageSwitch";
import { playPageSwitch, type PageSwitchHandle } from "../../lib/theme/playPageSwitch";
import { useAccentColor } from "../../lib/theme/useAccentColor";
import { useReducedMotion } from "../../lib/theme/useReducedMotion";
import { useResolvedTheme } from "../../lib/theme/useResolvedTheme";
import { openSettingsWindow } from "../settings/api";
import { IslandGlassLayer } from "../island/IslandGlassLayer";
import type { IslandPageProps } from "../island/IslandPages";
import { getTodoScrollStartRows } from "../island/layout";
import { pageSlot } from "../island/slots/pageSlot";
import type { IslandPage } from "../island/types";
import { useGlassPointer } from "../island/useGlassPointer";
import { useIslandGlass } from "../island/useIslandGlass";
import { usePageLabel } from "../island/usePageLabel";
import "../island/slots/builtins";
import { focusSideDock } from "./api";
import { SideDockDrawerHeader } from "./SideDockDrawerHeader";
import { renderSideDockIcon, sideDockPageLabel } from "./sideDockMeta";
import { SideDockRunners } from "./SideDockRunners";
import { computeSideDockSurface } from "./sideDockSurfaceStyle";
import { useSideDockHandleDrag } from "./useSideDockHandleDrag";
import { useSideDockPages } from "./useSideDockPages";
import { useSideDockState } from "./useSideDockState";
import "./SideDockWindow.css";
import "./SideDockPages.css";

function parseEdge(): SideDockEdge {
  return new URLSearchParams(window.location.search).get("edge") === "left" ? "left" : "right";
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest("input, textarea, select, [contenteditable='true']") !== null;
}

export function SideDockWindow() {
  const edge = useMemo(parseEdge, []);
  const t = useTranslation();
  const text = t.island.sideDock;
  const [storedSettings, setStoredSettings] = useIslandSettings();
  const settings = useResolvedTheme(storedSettings);
  const accent = useAccentColor(settings);
  const reducedMotion = useReducedMotion();
  const { layout: pageLayout } = useIslandPages();
  const { settings: sideDocks, save: saveSideDocks } = useSideDocks();
  const { pageLabel } = usePageLabel();
  const contributed = useIslandContributed();
  const sideConfig = sideDocks[edge];
  const bodyRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLElement>(null);
  const prevPageRef = useRef<string | null>(null);
  const switchHandleRef = useRef<PageSwitchHandle | null>(null);

  const enabledSides = useMemo(() => sideDockEnabledSides(sideDocks), [sideDocks]);
  const { features, dockPages, allEntries } = useSideDockPages(edge, settings, pageLayout, enabledSides);
  const showStrip = sideDocks.stages === 3 && dockPages.length > 0;

  const {
    visualState,
    closing,
    activePage,
    handleHovered,
    openOnTrigger,
    selectPage,
    togglePin,
    dismiss,
    handleHoverChange,
    clearTimers,
  } = useSideDockState({
    edge,
    sideDocks,
    saveSideDocks,
    stripCount: dockPages.length,
  });

  const handleDrag = useSideDockHandleDrag(edge, sideDocks, saveSideDocks, clearTimers, openOnTrigger);

  const currentEntry = useMemo(
    () => dockPages.find((entry) => entry.id === activePage) ?? dockPages[0] ?? null,
    [activePage, dockPages],
  );

  const labelFor = useCallback(
    (entry: (typeof dockPages)[number]) => sideDockPageLabel(entry, pageLabel, t.island),
    [pageLabel, t.island],
  );

  const stepPage = useCallback(
    (step: 1 | -1) => {
      if (dockPages.length < 2) return;
      const currentIndex = dockPages.findIndex((item) => item.id === currentEntry?.id);
      const next = dockPages[(currentIndex + step + dockPages.length) % dockPages.length];
      if (next) selectPage(next.id);
    },
    [currentEntry?.id, dockPages, selectPage],
  );

  useEffect(() => {
    void pluginRuntime("island");
    return () => {
      switchHandleRef.current?.finish();
    };
  }, []);

  useEffect(() => {
    if (visualState !== "drawer") return;
    stripRef.current?.querySelector<HTMLElement>("[data-active='true']")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [currentEntry?.id, visualState]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (visualState !== "drawer") return;
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        void openSettingsWindow("sideDocks");
        return;
      }
      const target = event.target as HTMLElement | null;
      const inInput = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (event.key === "Escape") {
        dismiss();
        return;
      }
      if (inInput || dockPages.length < 2) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        stepPage(event.key === "ArrowRight" ? 1 : -1);
      }
      if (event.altKey && event.key >= "1" && event.key <= "9") {
        const picked = dockPages[Number(event.key) - 1];
        if (picked) {
          event.preventDefault();
          selectPage(picked.id);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismiss, dockPages, selectPage, stepPage, visualState]);

  useLayoutEffect(() => {
    const nextId = currentEntry?.id ?? null;
    const prevId = prevPageRef.current;
    prevPageRef.current = nextId;
    const stage = bodyRef.current;
    if (!stage || !prevId || !nextId || prevId === nextId || visualState !== "drawer") return;
    switchHandleRef.current?.finish();
    switchHandleRef.current = null;
    const effect = resolvePageSwitch(
      settings.pageSwitchPanel,
      settings.pageSwitchPanel === "carousel" ? nextCarouselTurn() : 0,
      reducedMotion,
    );
    if (effect === "none") return;
    const prevIdx = dockPages.findIndex((item) => item.id === prevId);
    const nextIdx = dockPages.findIndex((item) => item.id === nextId);
    const direction = settings.pageSwitchDirectional && prevIdx >= 0 && nextIdx >= 0 ? (nextIdx > prevIdx ? 1 : -1) : 0;
    const targets = [...stage.children].filter((child): child is HTMLElement => child instanceof HTMLElement && !child.dataset.pageSwitchOverlay);
    if (targets.length === 0) return;
    switchHandleRef.current = playPageSwitch({
      stage,
      targets,
      effect,
      direction,
      axis: "x",
      origin: null,
      speed: pageSwitchSpeed(settings.pageSwitchSpeed),
    });
  }, [currentEntry?.id, dockPages, reducedMotion, settings.pageSwitchDirectional, settings.pageSwitchPanel, settings.pageSwitchSpeed, visualState]);

  const surface = useMemo(() => computeSideDockSurface(settings, sideDocks, accent), [accent, settings, sideDocks]);
  const { glass, glassStyle } = useIslandGlass({
    settings: surface.glassSettings,
    background: surface.backgroundHex,
    accent,
    cover: null,
    mode: visualState === "handle" ? "collapsed" : "expanded",
    isTucked: false,
    quiet: false,
    reducedMotion,
  });
  const { handleGlassPointerMove, resetGlassPointer } = useGlassPointer(surface.isGlass && glass.specular);
  const rootStyle = useMemo(() => ({ ...surface.style, ...(surface.isGlass ? glassStyle : {}) }), [glassStyle, surface.isGlass, surface.style]);

  const pageIds = useMemo(() => dockPages.map((entry) => entry.id), [dockPages]);

  const pageProps = useMemo<IslandPageProps | null>(() => {
    if (!currentEntry) return null;
    const base: IslandPageProps = {
      page: currentEntry.id as IslandPage,
      mode: "expanded",
      settings,
      features,
      onOpenSettings: openSettingsWindow,
      todoScrollStartRows: getTodoScrollStartRows(sideDocks.drawerHeight),
    };
    const folded = allEntries.find((entry) => entry.fold?.into === currentEntry.id && entry.fold.when(features));
    if (folded?.fold) {
      const Folded = folded.component;
      base.extraView = { label: folded.fold.label(t), content: <Folded {...base} embedded /> };
    }
    return base;
  }, [allEntries, currentEntry, features, settings, sideDocks.drawerHeight, t]);

  const openDockPage = useCallback((page: IslandPage) => selectPage(page), [selectPage]);
  const onDrawerPointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (isEditableTarget(event.target)) {
        void focusSideDock(edge).catch(() => undefined);
      }
    },
    [edge],
  );

  const handleStatus = contributed.status?.state === "waiting" ? "waiting" : contributed.status?.state === "running" ? "running" : "idle";
  const drawerGlassClass = surface.isGlass
    ? `island island--expanded island--appearance-liquidGlass island--glass-css-fallback ${glass.className}`
    : "";

  return (
    <JellyfishStyleContext.Provider value={settings.jellyfishStyle}>
      <SideDockRunners
        pageIds={pageIds}
        activePage={(currentEntry?.id ?? "todo") as IslandPage}
        expanded={visualState === "drawer"}
        isLight={surface.isLight}
        accent={accent}
        settings={settings}
        setSettings={setStoredSettings}
        features={features}
        dragDropShelf={sideDocks.dragDropShelf}
        onOpenPage={openDockPage}
        onSelectPage={openDockPage}
        onCollapse={dismiss}
        onReveal={openOnTrigger}
      />
      <div
        className={`side-dock-root stage--font-${settings.fontFamily}${surface.isLight ? " island-light" : ""}`}
        data-edge={edge}
        data-state={visualState}
        data-closing={closing}
        data-stages={showStrip ? 3 : 2}
        data-material={surface.isGlass ? "glass" : "solid"}
        data-density={sideDocks.density}
        style={rootStyle}
        onPointerEnter={() => { if (!handleDrag.dragging) handleHoverChange(true); }}
        onPointerLeave={() => { if (!handleDrag.dragging) handleHoverChange(false); }}
      >
        <div className="side-dock-stage">
          {visualState === "handle" ? (
            <button
              type="button"
              className="side-dock-handle-zone"
              data-hovered={handleHovered}
              data-dragging={handleDrag.dragging}
              aria-label={text.openAria}
              onPointerDown={handleDrag.onPointerDown}
              onClick={handleDrag.onClick}
            >
              <span className="side-dock-handle">
                {sideDocks.handleDot && <span className="side-dock-handle__dot" data-status={handleStatus} aria-hidden="true" />}
                <span className="side-dock-handle__pill" aria-hidden="true" />
              </span>
            </button>
          ) : (
            <>
              {visualState === "drawer" && (
                <section
                  className={`side-dock-drawer ${drawerGlassClass}`.trim()}
                  onPointerDownCapture={onDrawerPointerDownCapture}
                  onPointerMove={handleGlassPointerMove}
                  onPointerLeave={resetGlassPointer}
                >
                  {surface.isGlass && <IslandGlassLayer glass={glass} />}
                  <SideDockDrawerHeader
                    dockPages={dockPages}
                    currentEntry={currentEntry}
                    pageLayout={pageLayout}
                    fuyuTabIcon={settings.fuyuTabIcon}
                    headerStyle={sideDocks.headerStyle}
                    showStrip={showStrip}
                    pinned={sideConfig.pinned}
                    islandText={t.island}
                    labelFor={labelFor}
                    onSelectPage={selectPage}
                    onStepPage={stepPage}
                    onTogglePin={togglePin}
                    onDismiss={dismiss}
                  />
                  <div ref={bodyRef} className="side-dock-drawer__body">
                    {currentEntry && pageProps ? (
                      <SlotView
                        slot={pageSlot}
                        props={pageProps}
                        select={(items) => items.filter((item) => item.id === currentEntry.id)}
                      />
                    ) : (
                      <div className="side-dock-drawer__empty">
                        <span>{text.emptyHint}</span>
                        <button
                          type="button"
                          className="side-dock-drawer__empty-btn"
                          onClick={() => void openSettingsWindow("sideDocks")}
                        >
                          {text.openSettingsAria}
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              )}
              {showStrip && (
                <nav ref={stripRef} className="side-dock-strip" aria-label={text.title}>
                  {dockPages.map((entry) => {
                    const label = labelFor(entry);
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className="side-dock-strip__btn"
                        data-active={visualState === "drawer" && entry.id === currentEntry?.id}
                        title={label}
                        onPointerEnter={() => {
                          if (sideDocks.autoDrawer === "hover-item") {
                            selectPage(entry.id);
                          }
                        }}
                        onClick={() => selectPage(entry.id)}
                      >
                        <span className="side-dock-strip__icon">
                          {renderSideDockIcon(entry, label, pageLayout, settings.fuyuTabIcon, sideDocks.density === "compact" ? 14 : 15)}
                        </span>
                        {sideDocks.stripStyle === "label" && <span className="side-dock-strip__label">{label}</span>}
                      </button>
                    );
                  })}
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </JellyfishStyleContext.Provider>
  );
}
