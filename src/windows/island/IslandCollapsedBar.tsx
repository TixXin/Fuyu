import { Fragment, type ReactNode } from "react";
import { useCollapsedBarItems, type CollapsedBarItem } from "./collapsedBarItems";
import { arrangeCollapsedItems, zoneIds, type CollapsedZone } from "../../lib/settings/collapsedItems";
import { useCollapsedPlacements } from "../../lib/settings/useCollapsedPlacements";
import { useTranslation } from "../../i18n";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { leadLine, shownLine, visibleLines } from "../../features/plugin-kernel/islandContributions";
import { runIslandAction, useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import { lineSlot, type CollapsedLineContext } from "./slots/line";
import type { CollapsedSlots, IslandPage } from "./types";
import { useWindowDragGesture } from "./useWindowDragGesture";
import { hasNotchDrop, useIslandNotch } from "./notch";
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
};

const NO_SLOTS: CollapsedSlots = {};
const NO_SOURCES = {};
const OPENS_BAR = "data-opens-bar";

function renderZone(items: readonly CollapsedBarItem[]) {
  const out: ReactNode[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.group) {
      out.push(<Fragment key={item.id}>{item.node}</Fragment>);
      continue;
    }
    const group = [item];
    while (items[index + 1]?.group === item.group) group.push(items[(index += 1)]);
    out.push(<div key={group[0].id} className="island__gauge-slot">{group.map((member) => <Fragment key={member.id}>{member.node}</Fragment>)}</div>);
  }
  return out;
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
  const { placements: saved } = useCollapsedPlacements();
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

  const left = renderZone(zone("left"));
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
          <IslandSummary item={contributed.summary} enabled={!isExpanded && !isTucked} bodyOnly={notch !== null}>
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
        {renderZone(zone("right"))}
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
  const alerted = notch !== null && activeAlert !== null;
  const dropped = notch !== null && hasNotchDrop({ preview, notice, peek: peekLine });
  const messaged = notch !== null && !alerted && !notice && preview !== null;
  const wings = alerted ? "alert" : messaged ? `message:${preview?.key}` : dropped ? "dropped" : "idle";

  return (
    <div
      className="island__collapsed"
      aria-hidden={isExpanded}
      inert={isExpanded}
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
            <div key={`left:${wings}`} className="island__notch-wing island__notch-wing--left" {...{ [OPENS_BAR]: "" }}>{alerted && activeAlert ? <NotchAlertLeading alert={activeAlert} sources={alertSources} /> : messaged && preview ? lineView(`${preview.item}.leading`) : left}</div>
            <span className="island__notch-gap" aria-hidden="true" {...{ [OPENS_BAR]: "" }} />
            <div key={`right:${wings}`} className="island__notch-wing island__notch-wing--right" {...{ [OPENS_BAR]: "" }}>{alerted && activeAlert ? <NotchAlertTrailing alert={activeAlert} sources={alertSources} /> : messaged && preview ? lineView(`${preview.item}.trailing`) : dropped ? right : <>{message}{right}</>}</div>
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
