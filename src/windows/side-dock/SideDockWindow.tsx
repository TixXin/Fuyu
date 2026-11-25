import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Pin, PinOff, Settings, X } from "lucide-react";
import { JellyfishStyleContext } from "../../components/jellyfish/jellyfishStyleContext";
import { pluginRuntime } from "../../features/plugin-kernel/runtime";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { useTranslation } from "../../i18n";
import { hexToRgba } from "../../lib/settings/settings";
import { handleRadiusFor, innerRadiusFor, sideDockEnabledSides, type SideDockEdge } from "../../lib/settings/sideDocks";
import { useIslandPages } from "../../lib/settings/useIslandPages";
import { useIslandSettings } from "../../lib/settings/useIslandSettings";
import { useSideDocks } from "../../lib/settings/useSideDocks";
import { nextCarouselTurn, pageSwitchSpeed, resolvePageSwitch } from "../../lib/theme/pageSwitch";
import { playPageSwitch, type PageSwitchHandle } from "../../lib/theme/playPageSwitch";
import { accentVariables, inkVariables, surfaceThemeColors } from "../../lib/theme/themeMode";
import { useAccentColor } from "../../lib/theme/useAccentColor";
import { useResolvedTheme } from "../../lib/theme/useResolvedTheme";
import { isLightIsland } from "../../utils/color";
import { openSettingsWindow } from "../settings/api";
import type { IslandPageProps } from "../island/IslandPages";
import { getTodoScrollStartRows } from "../island/layout";
import { pageSlot } from "../island/slots/pageSlot";
import type { IslandPage } from "../island/types";
import { usePageLabel } from "../island/usePageLabel";
import "../island/slots/builtins";
import { stripWidthFor } from "./dockGeometry";
import { renderSideDockIcon, sideDockPageLabel } from "./sideDockMeta";
import { SideDockRunners } from "./SideDockRunners";
import { useSideDockPages } from "./useSideDockPages";
import { useSideDockState } from "./useSideDockState";
import "./SideDockWindow.css";

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
  const { layout: pageLayout } = useIslandPages();
  const { settings: sideDocks, save: saveSideDocks } = useSideDocks();
  const { pageLabel } = usePageLabel();
  const sideConfig = sideDocks[edge];
  const bodyRef = useRef<HTMLDivElement>(null);
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
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const effect = resolvePageSwitch(
      settings.pageSwitchPanel,
      settings.pageSwitchPanel === "carousel" ? nextCarouselTurn() : 0,
      reduced,
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
  }, [currentEntry?.id, dockPages, settings.pageSwitchDirectional, settings.pageSwitchPanel, settings.pageSwitchSpeed, visualState]);

  const panelLook = useMemo(() => surfaceThemeColors(settings, "panel"), [settings]);
  const followMain = sideDocks.appearance === "follow";
  const isLight = followMain ? isLightIsland(panelLook.islandBackgroundColor) : sideDocks.theme === "light";
  const isGlass = followMain ? settings.appearanceMode === "liquidGlass" : sideDocks.material === "glass";
  const surfaceFill = followMain
    ? hexToRgba(panelLook.islandBackgroundColor, settings.opacity / 100)
    : isGlass
      ? `rgba(${isLight ? "245, 247, 252" : "14, 15, 22"}, ${sideDocks.surfaceOpacity / 100})`
      : isLight
        ? "rgb(245, 247, 252)"
        : "rgb(18, 19, 26)";
  const panelBlurPx = followMain ? Math.round(14 + (settings.glassIntensity / 100) * 14) : 26;

  const rootStyle = useMemo<CSSProperties>(
    () =>
      ({
        ...(followMain ? inkVariables(panelLook) : {}),
        ...accentVariables(accent),
        "--side-surface-fill": surfaceFill,
        "--side-panel-blur": `${panelBlurPx}px`,
        "--side-outer-r": `${sideDocks.outerRadius}px`,
        "--side-inner-r": `${innerRadiusFor(sideDocks.outerRadius)}px`,
        "--side-handle-r": `${handleRadiusFor(sideDocks.outerRadius)}px`,
        "--side-handle-w": `${sideDocks.handleWidth}px`,
        "--side-handle-h": `${sideDocks.handleHeight}px`,
        "--side-handle-alpha": String(sideDocks.handleOpacity / 100),
        "--side-strip-w": `${stripWidthFor(sideDocks)}px`,
        "--side-gap": `${sideDocks.gap}px`,
        "--side-drawer-w": `${sideDocks.drawerWidth}px`,
        "--side-drawer-h": `${sideDocks.drawerHeight}px`,
      }) as CSSProperties,
    [accent, followMain, panelBlurPx, panelLook, sideDocks, surfaceFill],
  );

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

  return (
    <JellyfishStyleContext.Provider value={settings.jellyfishStyle}>
      <SideDockRunners
        pageIds={pageIds}
        activePage={(currentEntry?.id ?? "todo") as IslandPage}
        expanded={visualState === "drawer"}
        isLight={isLight}
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
        className={`side-dock-root stage--font-${settings.fontFamily}${isLight ? " island-light" : ""}`}
        data-edge={edge}
        data-state={visualState}
        data-closing={closing}
        data-stages={showStrip ? 3 : 2}
        data-material={isGlass ? "glass" : "solid"}
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
              onDragEnter={() => {
                if (sideDocks.dragDropShelf && pageIds.includes("shelf")) {
                  selectPage("shelf");
                }
              }}
            >
              <span className="side-dock-handle">
                {sideDocks.handleDot && <span className="side-dock-handle__dot" aria-hidden="true" />}
                <span className="side-dock-handle__pill" aria-hidden="true" />
              </span>
            </button>
          ) : (
            <>
              {visualState === "drawer" && (
                <section className="side-dock-drawer">
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
                      <div className="side-dock-drawer__tabs" role="tablist">
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
