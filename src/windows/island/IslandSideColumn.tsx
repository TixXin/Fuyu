import { useEffect, type ReactNode } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { useTranslation } from "../../i18n";
import { layoutSideColumn, SIDE_COLUMN_MAX_HEIGHT, SIDE_ROW_HEIGHT, type SideColumnLayout } from "./sideColumn";
import { setIslandSideColumn } from "./api";
import { SIDE_GAUGES_ORDER, sideSlot, type SideRowContext } from "./slots/side";
import { useWindowDragGesture } from "./useWindowDragGesture";
import "./IslandSideColumn.css";

export type SideColumnRow = { id: string; height: number; grow?: boolean; node: ReactNode };

type IslandSideColumnProps = {
  label: string;
  hot: string | null;
  layout: SideColumnLayout<SideColumnRow>;
  probes?: ReactNode;
  onOpen: () => void;
  onWindowDragStart: () => void;
};

function stop(event: { stopPropagation: () => void }, action: () => void) {
  event.stopPropagation();
  action();
}

export function useSideColumnRows(context: SideRowContext, gauges: readonly { id: string; node: ReactNode }[], target: number | null, extra: readonly SideColumnRow[] = []) {
  const entries = useSlotEntries(sideSlot);
  const { side } = useIslandContributed();
  const rows: SideColumnRow[] = [];
  let gaugesPlaced = false;
  const placeGauges = () => {
    gaugesPlaced = true;
    for (const gauge of gauges) rows.push({ id: gauge.id, height: SIDE_ROW_HEIGHT, node: gauge.node });
  };
  for (const entry of entries) {
    if (!gaugesPlaced && entry.order >= SIDE_GAUGES_ORDER) placeGauges();
    const row = side.get(entry.id);
    if (row) rows.push({ id: entry.id, height: row.height, grow: row.grow, node: <SlotView slot={sideSlot} props={context} select={() => [entry]} /> });
  }
  if (!gaugesPlaced) placeGauges();
  rows.push(...extra);
  return layoutSideColumn(rows, target ?? SIDE_COLUMN_MAX_HEIGHT, target !== null);
}

export function IslandSideColumn({ label, hot, layout, probes = null, onOpen, onWindowDragStart }: IslandSideColumnProps) {
  const t = useTranslation();
  const { didDragRef, prepareWindowDrag, handleWindowDragMove, cancelWindowDrag } = useWindowDragGesture(false, onWindowDragStart);

  useEffect(() => {
    if (!isTauri()) return;
    void setIslandSideColumn(layout.height).catch((error) => console.error("Failed to size the side island", error));
  }, [layout.height]);

  return (
    <div
      className="island-side-column"
      role="button"
      tabIndex={0}
      aria-label={label}
      onPointerDown={prepareWindowDrag}
      onPointerMove={handleWindowDragMove}
      onPointerUp={cancelWindowDrag}
      onPointerCancel={cancelWindowDrag}
      onClick={() => {
        if (!didDragRef.current) onOpen();
      }}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      {layout.shown.map((row, index) => (
        <span key={row.id} data-side-item={row.id} className={`island-side-row${hot === row.id ? " island-side-row--hot" : ""}`} style={{ top: layout.offsets[index], height: row.height }}>
          {row.node}
        </span>
      ))}
      {layout.hidden > 0 && (
        <button
          type="button"
          className="island-side-row island-side-more"
          style={{ top: layout.offsets[layout.shown.length] }}
          aria-label={t.island.sideMore(layout.hidden)}
          onClick={(event) => stop(event, onOpen)}
        >
          +{layout.hidden}
        </button>
      )}
      {probes}
    </div>
  );
}
