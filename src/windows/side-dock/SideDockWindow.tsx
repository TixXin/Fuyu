import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type WheelEvent } from "react";
import { ChevronLeft, ChevronRight, Pin, PinOff, Settings, X } from "lucide-react";
import { JellyfishStyleContext } from "../../components/jellyfish/jellyfishStyleContext";
import { pluginRuntime } from "../../features/plugin-kernel/runtime";
import { SlotView } from "../../features/plugin-kernel/SlotView";
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
import { renderSideDockIcon, sideDockPageLabel } from "./sideDockMeta";
import { SideDockRunners } from "./SideDockRunners";
import { computeSideDockSurface } from "./sideDockSurfaceStyle";
import { useSideDockPages } from "./useSideDockPages";
import { useSideDockState } from "./useSideDockState";
import "./SideDockWindow.css";
import "./SideDockPages.css";

function parseEdge(): SideDockEdge {
  return new URLSearchParams(window.location.search).get("edge") === "left" ? "left" : "right";
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
  const sideConfig = sideDocks[edge];
  const bodyRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const prevPageRef = useRef<string | null>(null);
  const switchHandleRef = useRef<PageSwitchHandle | null>(null);

  const enabledSides = useMemo(() => sideDockEnabledSides(sideDocks), [sideDocks]);
  const { features, dockPages, allEntries } = useSideDockPages(edge, settings, pageLayout, enabledSides);
  const stripPages = useMemo(() => dockPages.slice(0, 6), [dockPages]);
  const showStrip = sideDocks.stages === 3 && stripPages.length > 0;

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
  } = useSideDockState({
    edge,
    sideDocks,
    saveSideDocks,
    stripCount: stripPages.length,
  });

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

  const minimalHeader = sideDocks.headerStyle === "minimal";
  const openDockPage = useCallback((page: IslandPage) => selectPage(page), [selectPage]);
  const onTabsWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const el = tabsRef.current;
    if (!el || el.scrollWidth <= el.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    el.scrollLeft += event.deltaY;
  }, []);

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
        onPointerEnter={() => handleHoverChange(true)}
        onPointerLeave={() => handleHoverChange(false)}
      >
        <div className="side-dock-stage">
          {visualState === "handle" ? (
            <button
              type="button"
              className="side-dock-handle-zone"
              data-hovered={handleHovered}
              aria-label={text.openAria}
              onClick={openOnTrigger}
            >
              <span className="side-dock-handle">
                {sideDocks.handleDot && <span className="side-dock-handle__dot" aria-hidden="true" />}
                <span className="side-dock-handle__pill" aria-hidden="true" />
              </span>
            </button>
          ) : (
            <>
              {visualState === "drawer" && (
                <section
                  className={`side-dock-drawer ${drawerGlassClass}`.trim()}
                  onPointerMove={handleGlassPointerMove}
                  onPointerLeave={resetGlassPointer}
                >
                  {surface.isGlass && <IslandGlassLayer glass={glass} />}
                  <header className="side-dock-drawer__head">
                    {minimalHeader ? (
                      <div className="side-dock-drawer__title">
                        {currentEntry ? renderSideDockIcon(currentEntry, labelFor(currentEntry), pageLayout, settings.fuyuTabIcon) : null}
                        <span className="side-dock-drawer__title-text">
                          {currentEntry ? labelFor(currentEntry) : text.title}
                        </span>
                        {!showStrip && dockPages.length > 1 && (
                          <div className="side-dock-drawer__steppers">
                            <button type="button" className="side-dock-drawer__action" onClick={() => stepPage(-1)} aria-label={t.island.pageArrow.previous(currentEntry ? labelFor(currentEntry) : text.title)}>
                              <ChevronLeft size={14} strokeWidth={1.7} />
                            </button>
                            <button type="button" className="side-dock-drawer__action" onClick={() => stepPage(1)} aria-label={t.island.pageArrow.next(currentEntry ? labelFor(currentEntry) : text.title)}>
                              <ChevronRight size={14} strokeWidth={1.7} />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div ref={tabsRef} className="side-dock-drawer__tabs" role="tablist" onWheel={onTabsWheel}>
                        {dockPages.map((entry) => {
                          const label = labelFor(entry);
                          return (
                            <button
                              key={entry.id}
                              type="button"
                              role="tab"
                              aria-selected={entry.id === currentEntry?.id}
                              className="side-dock-drawer__tab"
                              data-active={entry.id === currentEntry?.id}
                              title={label}
                              onClick={() => selectPage(entry.id)}
                            >
                              {renderSideDockIcon(entry, label, pageLayout, settings.fuyuTabIcon)}
                              {sideDocks.headerStyle !== "icons" && <span>{label}</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="side-dock-drawer__actions">
                      <button
                        type="button"
                        className="side-dock-drawer__action"
                        data-active={sideConfig.pinned}
                        aria-label={text.pinAria}
                        title={text.pinAria}
                        onClick={togglePin}
                      >
                        {sideConfig.pinned ? <PinOff size={14} strokeWidth={1.6} /> : <Pin size={14} strokeWidth={1.6} />}
                      </button>
                      <button
                        type="button"
                        className="side-dock-drawer__action"
                        aria-label={text.openSettingsAria}
                        title={text.openSettingsAria}
                        onClick={() => void openSettingsWindow("sideDocks")}
                      >
                        <Settings size={14} strokeWidth={1.6} />
                      </button>
                      <button
                        type="button"
                        className="side-dock-drawer__action"
                        aria-label={text.closeAria}
                        onClick={dismiss}
                      >
                        <X size={14} strokeWidth={1.6} />
                      </button>
                    </div>
                  </header>
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
                <nav className="side-dock-strip" aria-label={text.title}>
                  {stripPages.map((entry) => {
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
