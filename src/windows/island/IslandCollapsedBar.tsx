import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { useCollapsedBarItems, type CollapsedBarItem } from "./collapsedBarItems";
import { arrangeCollapsedItems, saveCollapsedOverflow, shelfIds, zoneIds, type CollapsedZone } from "../../lib/settings/collapsedItems";
import { useCollapsedPlacements } from "../../lib/settings/useCollapsedPlacements";
import { useTranslation } from "../../i18n";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { leadLine, shownLine, visibleLines } from "../../features/plugin-kernel/islandContributions";
import { runIslandAction, useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import { lineSlot, type CollapsedLineContext } from "./slots/line";
import type { CollapsedSlots, IslandPage } from "./types";
import { useCollapsedContextMenu } from "./useCollapsedContextMenu";
import { useWindowDragGesture } from "./useWindowDragGesture";
import { hasNotchDrop, MAX_NOTCH_WING, useIslandNotch } from "./notch";
import { CollapsedMore } from "./CollapsedMore";
import { BAR_UNIT, useCollapsedOverflow, type CollapsedOverflowState } from "./useCollapsedOverflow";
import { useCollapsedItemNames } from "./useCollapsedItemNames";
import { AlertPopup, NotchAlertLeading, NotchAlertTrailing, useActiveAlert } from "./NotchAlert";
import { IslandSummary } from "./IslandSummary";
import { DevWatermark } from "../../components/DevWatermark";
import "./IslandCollapsedBar.css";

type IslandCollapsedBarProps = {
  page: IslandPage;
  isExpanded: boolean;
  isTucked: boolean;
  showTitle: boolean;
  showCollapsedText: boolean;
  collapsedLabel: string;
  agentVisualState: string;
  onOpenPage: (page: IslandPage) => void;
  notice?: { content: ReactNode; actions: ReactNode } | null;
  onWindowDragStart: () => void;
  onTuck: () => void;
  slots?: CollapsedSlots;
  overflowMore?: boolean;
  notchWingMax?: number;
};

const NO_SLOTS: CollapsedSlots = {};
const NO_SOURCES = {};
const OPENS_BAR = "data-opens-bar";

type BarUnit = { key: string; ids: string[]; node: ReactNode };

function barUnits(items: readonly CollapsedBarItem[]): BarUnit[] {
  const units: BarUnit[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.group) {
      units.push({ key: item.id, ids: [item.id], node: item.node });
      continue;
    }
    const group = [item];
    while (items[index + 1]?.group === item.group) group.push(items[(index += 1)]);
    units.push({ key: group[0].id, ids: group.map((member) => member.id), node: <div className="island__gauge-slot">{group.map((member) => <Fragment key={member.id}>{member.node}</Fragment>)}</div> });
  }
  return units;
}

function renderUnits(units: readonly BarUnit[], overflow: CollapsedOverflowState) {
  if (!overflow.fitting) return units.map((unit) => <Fragment key={unit.key}>{unit.node}</Fragment>);
  return units
    .filter((unit) => !unit.ids.every((id) => overflow.shelved.has(id)))
    .map((unit) => <span key={unit.key} className="island__bar-unit" {...{ [BAR_UNIT]: unit.key }}>{unit.node}</span>);
}

export function IslandCollapsedBar({
  page,
  isExpanded,
  isTucked,
  showTitle,
  showCollapsedText,
  collapsedLabel,
  agentVisualState,
  onOpenPage,
  notice = null,
  onWindowDragStart,
  onTuck,
  slots = NO_SLOTS,
  overflowMore = true,
  notchWingMax = MAX_NOTCH_WING,
}: IslandCollapsedBarProps) {
  const t = useTranslation();
  const notch = useIslandNotch();
  const { didDragRef, prepareWindowDrag, handleWindowDragMove, cancelWindowDrag } =
    useWindowDragGesture(isTucked, onWindowDragStart);
  const pulseClassName = [
    "island__pulse",
    `island__pulse--agent-${agentVisualState}`,
  ].join(" ");
  const contributed = useIslandContributed();
  const preview = contributed.preview;
  const activeAlert = useActiveAlert();
  const alertSources = NO_SOURCES;
  const lines = visibleLines(contributed.lines, showCollapsedText);
  const line = shownLine(lines);
  const peekLine = line?.drop ? line : null;
  const openTarget = (line?.page ?? leadLine(contributed.lines)?.page ?? page) as IslandPage;
  const openPeek = () => {
    if (peekLine?.action) runIslandAction(peekLine.action);
  };
  const lineContext: CollapsedLineContext = { showTitle, center: slots.center ?? null, agentIcon: slots.agentIcon ?? null };
  const lineView = (id: string) => <SlotView key={id} slot={lineSlot} props={lineContext} select={(items) => items.filter((item) => item.id === id)} />;
  const showCenter = Boolean(slots.center) && !preview && !peekLine && !notice
    && !(showCollapsedText && (showTitle || lines.some((candidate) => candidate.reserve !== true && candidate.measure !== undefined)));
  const { placements: saved, save: savePlacements } = useCollapsedPlacements();
  const openItemsMenu = useCollapsedContextMenu(!isExpanded && !isTucked, savePlacements);
  const items = useCollapsedBarItems({
    t,
    statusLight: slots.statusLight
      ? <span className="island__mark-light" {...{ [OPENS_BAR]: "" }}>{slots.statusLight}</span>
      : <span className={pulseClassName} {...{ [OPENS_BAR]: "" }} />,
    hints: contributed.hints,
    slots,
    onOpenPage,
  });
  const offered = items.map(({ id }) => id);
  const placements = arrangeCollapsedItems(offered, saved);
  const byId = new Map(items.map((item) => [item.id, item]));
  const zone = (name: CollapsedZone) => zoneIds(placements, name, offered).flatMap((id) => byId.get(id) ?? []);

  const alerted = notch !== null && activeAlert !== null;
  const dropped = notch !== null && hasNotchDrop({ preview, notice, peek: peekLine });
  const messaged = notch !== null && !alerted && !notice && preview !== null;
  const wings = alerted ? "alert" : messaged ? `message:${preview?.key}` : dropped ? "dropped" : "idle";
  const leftWingRef = useRef<HTMLDivElement>(null);
  const rightWingRef = useRef<HTMLDivElement>(null);
  const leftItems = zone("left");
  const rightItems = zone("right");
  const leftUnits = barUnits(leftItems);
  const rightUnits = barUnits(rightItems);
  const pinned = new Set(shelfIds(placements, offered));
  const overflow = useCollapsedOverflow(
    notch !== null && (overflowMore || pinned.size > 0),
    !isExpanded && !isTucked && (wings === "idle" || wings === "dropped"),
    { left: leftUnits, right: rightUnits },
    { left: leftWingRef, right: rightWingRef },
    { auto: overflowMore, forceChip: pinned.size > 0, maxWing: notchWingMax },
  );
  const overflowKey = [...overflow.shelved].join("\n");
  useEffect(() => {
    saveCollapsedOverflow(overflowKey === "" ? [] : overflowKey.split("\n"));
  }, [overflowKey]);
  const nameOf = useCollapsedItemNames();
  const moreRows = placements
    .flatMap((placement) => (placement.hidden ? [] : byId.get(placement.id) ?? []))
    .filter((item) => pinned.has(item.id) || overflow.shelved.has(item.id))
    .map((item) => ({ id: item.id, name: nameOf(item.id), page: item.page ?? null }));
  const chipSide = notch !== null ? overflow.chip : pinned.size > 0 ? "end" : null;
  const more = (side: "left" | "right" | "end") => chipSide === side && moreRows.length > 0 && <CollapsedMore rows={moreRows} onOpenPage={onOpenPage} reserve={side === "end"} />;

  const left = <>{renderUnits(leftUnits, overflow)}{more("left")}</>;
  const message = (
    <>
        <button
          className={`island__open-button${showCenter ? " island__open-button--center" : ""}`}
          type="button"
          aria-label={preview?.label !== undefined
            ? preview.label
            : peekLine ? peekLine.label : t.messages.expand(collapsedLabel)}
          data-tooltip=""
          aria-expanded={preview || peekLine ? undefined : isExpanded}
          aria-controls={preview || peekLine ? undefined : "island-panel"}
          onPointerDown={prepareWindowDrag}
          onPointerMove={handleWindowDragMove}
          onPointerUp={cancelWindowDrag}
          onPointerCancel={cancelWindowDrag}
          onClick={(event) => {
            if (event.detail === 0 || !didDragRef.current) {
              if (preview) {
                if (preview.action) runIslandAction(preview.action);
              } else if (peekLine) {
                openPeek();
              } else {
                onOpenPage(openTarget);
              }
            }
          }}
        >
          <IslandSummary item={contributed.summary} enabled={!isExpanded && !isTucked} bodyOnly={notch !== null} grow={notch === null}>
            {notice ? notice.content : activeAlert ? (
              <AlertPopup alert={activeAlert} sources={alertSources} />
            ) : line?.bare ? lineView(line.item) : <>
            {showCollapsedText && showTitle && (
              <span className="island__brand">{t.island.appName}</span>
            )}
            {line && lineView(line.item)}
            </>}
          </IslandSummary>
          {showCenter && <span className="island__center-slot">{slots.center}</span>}
        </button>
        {notice && !preview && notice.actions}
        {!preview && !notice && !activeAlert && !peekLine && contributed.trails.map(lineView)}
        {preview && lineView(`${preview.item}.actions`)}
    </>
  );
  const right = (
    <>
        {renderUnits(rightUnits, overflow)}
        {more("end")}
        {!contributed.hints.has("agents.count") && (
          <button
            className="island__quiet-button"
            type="button"
            aria-label={t.island.collapseIsland}
            data-tooltip=""
            onClick={(event) => {
              event.stopPropagation();
              onTuck();
            }}
          />
        )}
    </>
  );
  return (
    <div
      className="island__collapsed"
      aria-hidden={isExpanded}
      inert={isExpanded}
      onContextMenu={openItemsMenu}
      onClick={(event) => {
        if (event.target === event.currentTarget || (event.target instanceof Element && event.target.hasAttribute(OPENS_BAR))) {
          if (peekLine && !preview) openPeek();
          else onOpenPage(openTarget);
        }
      }}
    >
      <DevWatermark place="collapsed" />
      {notch ? (
        <>
          <div className="island__notch-row">
            <div key={`left:${wings}`} ref={leftWingRef} className="island__notch-wing island__notch-wing--left" {...{ [OPENS_BAR]: "" }}>{alerted && activeAlert ? <NotchAlertLeading alert={activeAlert} sources={alertSources} /> : messaged && preview ? lineView(`${preview.item}.leading`) : left}</div>
            <span className="island__notch-gap" aria-hidden="true" {...{ [OPENS_BAR]: "" }} />
            <div key={`right:${wings}`} ref={rightWingRef} className="island__notch-wing island__notch-wing--right" {...{ [OPENS_BAR]: "" }}>{alerted && activeAlert ? <NotchAlertTrailing alert={activeAlert} sources={alertSources} /> : messaged && preview ? lineView(`${preview.item}.trailing`) : dropped ? <>{more("right")}{right}</> : <>{more("right")}{message}{right}</>}</div>
          </div>
          {dropped && <div className="island__notch-drop">{message}</div>}
        </>
      ) : (
        <>
          {left}
          {message}
          {right}
        </>
      )}
    </div>
  );
}
