import { useState, type DragEvent } from "react";
import { GripVertical, LayoutGrid } from "lucide-react";
import { FuyuTextIcon } from "../../../components/island-widget/FuyuTextIcon";
import { useTranslation } from "../../../i18n";
import {
  pageDockZone,
  placeIslandPage,
  setIslandPageHidden,
  setIslandPagePlacement,
  type DockZone,
  type IslandPagesLayout,
} from "../../../lib/settings/islandPages";
import {
  applySideDockSplitPreset,
  DEFAULT_SIDE_DOCKS,
  type SideDockEdge,
  type SideDocksSettings,
} from "../../../lib/settings/sideDocks";
import type { IslandPageRow } from "./useIslandPageRows";
import "./SideDockSpatialBoard.css";

type DropBucket = DockZone | "hidden";

type SideDockSpatialBoardProps = {
  rows: readonly IslandPageRow[];
  layout: IslandPagesLayout;
  saveLayout: (next: IslandPagesLayout) => void;
  sideDocks: SideDocksSettings;
  saveSideDocks: (next: SideDocksSettings) => void;
};

export function SideDockSpatialBoard({
  rows,
  layout,
  saveLayout,
  sideDocks,
  saveSideDocks,
}: SideDockSpatialBoardProps) {
  const text = useTranslation().settings.islandPages.sideDocks;
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overBucket, setOverBucket] = useState<DropBucket | null>(null);
  const [overChipId, setOverChipId] = useState<string | null>(null);

  const activeRows = rows.filter((row) => !row.off);
  const listedIds = activeRows.map((row) => row.id);

  const buckets: Record<DropBucket, IslandPageRow[]> = {
    left: [],
    top: [],
    right: [],
    hidden: [],
  };

  for (const row of activeRows) {
    if (row.hidden) {
      buckets.hidden.push(row);
    } else {
      buckets[pageDockZone(layout, row.id)].push(row);
    }
  }

  const movePage = (pageId: string, bucket: DropBucket, beforeId: string | null = null) => {
    let nextLayout = layout;
    if (bucket === "hidden") {
      nextLayout = setIslandPageHidden(nextLayout, pageId, true);
      saveLayout(nextLayout);
      return;
    }
    nextLayout = setIslandPageHidden(nextLayout, pageId, false);
    nextLayout = setIslandPagePlacement(nextLayout, pageId, bucket);
    if (beforeId !== null) {
      nextLayout = placeIslandPage(nextLayout, listedIds, pageId, beforeId);
    }
    saveLayout(nextLayout);
    if ((bucket === "left" || bucket === "right") && !sideDocks[bucket].enabled) {
      saveSideDocks({
        ...sideDocks,
        [bucket]: { ...sideDocks[bucket], enabled: true, lastPage: pageId },
      });
    }
  };

  const toggleEdge = (edge: SideDockEdge) => {
    saveSideDocks({
      ...sideDocks,
      [edge]: { ...sideDocks[edge], enabled: !sideDocks[edge].enabled },
    });
  };

  const handleAutoSplit = () => {
    const visibleIds = activeRows.filter((row) => !row.hidden).map((row) => row.id);
    const applied = applySideDockSplitPreset(sideDocks, layout, { pageIds: visibleIds });
    saveLayout(applied.layout);
    saveSideDocks(applied.settings);
  };

  const handleAllToTop = () => {
    let nextLayout = layout;
    for (const row of activeRows) {
      nextLayout = setIslandPagePlacement(nextLayout, row.id, "top");
    }
    saveLayout(nextLayout);
  };

  const handleReset = () => {
    handleAllToTop();
    saveSideDocks(DEFAULT_SIDE_DOCKS);
  };

  const onZoneDragOver = (bucket: DropBucket) => (event: DragEvent) => {
    if (!draggingId) return;
    event.preventDefault();
    if (overBucket !== bucket) setOverBucket(bucket);
  };

  const onZoneDrop = (bucket: DropBucket) => (event: DragEvent) => {
    if (!draggingId) return;
    event.preventDefault();
    movePage(draggingId, bucket);
    setDraggingId(null);
    setOverBucket(null);
    setOverChipId(null);
  };

  const renderChip = (row: IslandPageRow, bucket: DropBucket) => {
    const Icon = row.icon === FuyuTextIcon ? LayoutGrid : row.icon;
    return (
      <div
        key={row.id}
        className="sd-chip"
        data-dragging={draggingId === row.id}
        data-drop-before={overChipId === row.id && draggingId !== null && draggingId !== row.id}
        draggable
        onDragStart={(event) => {
          setDraggingId(row.id);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", row.id);
        }}
        onDragEnd={() => {
          setDraggingId(null);
          setOverBucket(null);
          setOverChipId(null);
        }}
        onDragOver={(event) => {
          if (!draggingId || draggingId === row.id) return;
          event.preventDefault();
          if (overChipId !== row.id) setOverChipId(row.id);
        }}
        onDragLeave={() => {
          setOverChipId((current) => (current === row.id ? null : current));
        }}
        onDrop={(event) => {
          if (!draggingId || draggingId === row.id) return;
          event.preventDefault();
          event.stopPropagation();
          movePage(draggingId, bucket, row.id);
          setDraggingId(null);
          setOverBucket(null);
          setOverChipId(null);
        }}
      >
        <GripVertical size={12} strokeWidth={1.6} className="sd-chip__grip" aria-hidden="true" />
        <Icon size={14} strokeWidth={1.6} aria-hidden="true" />
        <span className="sd-chip__name">{row.name}</span>
      </div>
    );
  };

  const renderEdgeZone = (edge: SideDockEdge) => {
    const enabled = sideDocks[edge].enabled;
    const list = buckets[edge];
    return (
      <div
        className={`sd-zone sd-zone--${edge}`}
        data-active={enabled}
        data-over={overBucket === edge}
        onDragOver={onZoneDragOver(edge)}
        onDragLeave={() => setOverBucket((current) => (current === edge ? null : current))}
        onDrop={onZoneDrop(edge)}
      >
        <div className="sd-zone__head">
          <span>{edge === "left" ? text.zones.left : text.zones.right}</span>
          <button
            type="button"
            className="sd-edge-toggle"
            data-on={enabled}
            onClick={() => toggleEdge(edge)}
          >
            {enabled ? text.zones.enabled : text.zones.disabled}
          </button>
        </div>
        <div className="sd-zone__list">
          {list.length > 0 ? list.map((row) => renderChip(row, edge)) : <span className="sd-zone__empty">{text.zones.dropHint}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="sd-block">
      <div className="sd-block__head">
        <div>
          <h4 className="sd-block__subtitle">{text.zones.centerTitle}</h4>
          <p className="sd-block__hint">{text.zones.centerHint}</p>
        </div>
        <div className="sd-block__actions">
          <button type="button" className="sd-btn sd-btn--accent" onClick={handleAutoSplit}>{text.autoSplit}</button>
          <button type="button" className="sd-btn" onClick={handleAllToTop}>{text.allToTop}</button>
          <button type="button" className="sd-btn" onClick={handleReset}>{text.reset}</button>
        </div>
      </div>

      <div className="sd-board">
        {renderEdgeZone("left")}
        <div
          className="sd-zone sd-zone--top"
          data-over={overBucket === "top"}
          onDragOver={onZoneDragOver("top")}
          onDragLeave={() => setOverBucket((current) => (current === "top" ? null : current))}
          onDrop={onZoneDrop("top")}
        >
          <div className="sd-zone__head">
            <span>{text.zones.top}</span>
            <span className="sd-zone__count">{buckets.top.length}</span>
          </div>
          <div className="sd-zone__list sd-zone__list--row">
            {buckets.top.length > 0 ? buckets.top.map((row) => renderChip(row, "top")) : <span className="sd-zone__empty">{text.zones.dropHint}</span>}
          </div>
        </div>

        <div className="sd-board__center">
          <strong>{`${text.zones.left} ${buckets.left.length} · ${text.zones.top} ${buckets.top.length} · ${text.zones.right} ${buckets.right.length}`}</strong>
          <span>{text.zones.centerHint}</span>
        </div>

        {renderEdgeZone("right")}

        <div
          className="sd-zone sd-zone--hidden"
          data-over={overBucket === "hidden"}
          onDragOver={onZoneDragOver("hidden")}
          onDragLeave={() => setOverBucket((current) => (current === "hidden" ? null : current))}
          onDrop={onZoneDrop("hidden")}
        >
          <div className="sd-zone__head">
            <span>{text.zones.hidden}</span>
            <span className="sd-zone__count">{buckets.hidden.length}</span>
          </div>
          <div className="sd-zone__list sd-zone__list--row">
            {buckets.hidden.length > 0 ? buckets.hidden.map((row) => renderChip(row, "hidden")) : <span className="sd-zone__empty">{text.zones.hiddenHint}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
