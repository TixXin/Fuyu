import { useCallback, useEffect, useRef, type WheelEvent } from "react";
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelRightClose, Pin, PinOff, Settings } from "lucide-react";
import type { IslandText } from "../../i18n/sections/island";
import type { IslandPagesLayout } from "../../lib/settings/islandPages";
import type { SideDockEdge, SideDockHeaderStyle } from "../../lib/settings/sideDocks";
import { openSettingsWindow } from "../settings/api";
import type { IslandPage } from "../island/types";
import { usePageHoverSwitch } from "../island/usePageHoverSwitch";
import { renderSideDockIcon, type SideDockPageEntry } from "./sideDockMeta";
import { useSideDockPill } from "./useSideDockPill";
import "./SideDockDrawerHeader.css";

type SideDockDrawerHeaderProps = {
  edge: SideDockEdge;
  dockPages: readonly SideDockPageEntry[];
  currentEntry: SideDockPageEntry | null;
  pageLayout: IslandPagesLayout;
  fuyuTabIcon: boolean;
  headerStyle: SideDockHeaderStyle;
  showStrip: boolean;
  pinned: boolean;
  reducedMotion: boolean;
  hoverSwitchPage: boolean;
  hoverSwitchDelayMs: number;
  islandText: IslandText;
  labelFor: (entry: SideDockPageEntry) => string;
  onSelectPage: (pageId: string) => void;
  onStepPage: (step: 1 | -1) => void;
  onTogglePin: () => void;
  onDismiss: () => void;
};

export function SideDockDrawerHeader({
  edge,
  dockPages,
  currentEntry,
  pageLayout,
  fuyuTabIcon,
  headerStyle,
  showStrip,
  pinned,
  reducedMotion,
  hoverSwitchPage,
  hoverSwitchDelayMs,
  islandText,
  labelFor,
  onSelectPage,
  onStepPage,
  onTogglePin,
  onDismiss,
}: SideDockDrawerHeaderProps) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const text = islandText.sideDock;
  const minimalHeader = headerStyle === "minimal";
  const pillKey = `${currentEntry?.id ?? ""}|${headerStyle}|${dockPages.length}`;
  const tabPillRef = useSideDockPill(tabsRef, "x", pillKey, reducedMotion);
  const hoverSwitch = usePageHoverSwitch(
    hoverSwitchPage && !minimalHeader,
    hoverSwitchDelayMs,
    (currentEntry?.id ?? "todo") as IslandPage,
    onSelectPage,
  );

  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>("[data-active='true']")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [currentEntry?.id]);

  const onTabsWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const el = tabsRef.current;
    if (!el || el.scrollWidth <= el.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    el.scrollLeft += event.deltaY;
  }, []);

  return (
    <header className="side-dock-drawer__head">
      {minimalHeader ? (
        <div className="side-dock-drawer__title">
          {currentEntry ? renderSideDockIcon(currentEntry, labelFor(currentEntry), pageLayout, fuyuTabIcon) : null}
          <span className="side-dock-drawer__title-text">
            {currentEntry ? labelFor(currentEntry) : text.title}
          </span>
          {!showStrip && dockPages.length > 1 && (
            <div className="side-dock-drawer__steppers">
              <button
                type="button"
                className="side-dock-drawer__action"
                onClick={() => onStepPage(-1)}
                aria-label={islandText.pageArrow.previous(currentEntry ? labelFor(currentEntry) : text.title)}
              >
                <ChevronLeft size={14} strokeWidth={1.7} />
              </button>
              <button
                type="button"
                className="side-dock-drawer__action"
                onClick={() => onStepPage(1)}
                aria-label={islandText.pageArrow.next(currentEntry ? labelFor(currentEntry) : text.title)}
              >
                <ChevronRight size={14} strokeWidth={1.7} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div ref={tabsRef} className="side-dock-drawer__tabs" role="tablist" onWheel={onTabsWheel}>
          <span ref={tabPillRef} className="side-dock-drawer__tab-pill" aria-hidden="true" />
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
                {...hoverSwitch(entry.id as IslandPage)}
                onClick={() => onSelectPage(entry.id)}
              >
                {renderSideDockIcon(entry, label, pageLayout, fuyuTabIcon)}
                {headerStyle !== "icons" && <span>{label}</span>}
              </button>
            );
          })}
        </div>
      )}
      <div className="side-dock-drawer__actions">
        <button
          type="button"
          className="side-dock-drawer__action"
          data-active={pinned}
          aria-label={text.pinAria}
          title={text.pinAria}
          onClick={onTogglePin}
        >
          {pinned ? <PinOff size={14} strokeWidth={1.6} /> : <Pin size={14} strokeWidth={1.6} />}
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
          title={text.closeAria}
          onClick={onDismiss}
        >
          {edge === "left" ? <PanelLeftClose size={14} strokeWidth={1.6} /> : <PanelRightClose size={14} strokeWidth={1.6} />}
        </button>
      </div>
    </header>
  );
}
