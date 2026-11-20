import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { SlotView } from "../../../features/plugin-kernel/SlotView";
import { useTranslation } from "../../../i18n";
import { cellBox, cellsToPx, GRID_CELL_PX, GRID_GAP_PX, gridRows, gridWidthPx, type PanelItem } from "../../../lib/settings/customPanels";
import { useCustomPanels } from "../../../lib/settings/useCustomPanels";
import { openSettingsWindow } from "../../settings/api";
import { widgetSlot } from "../slots/widget";
import "./CustomPanelPage.css";

const CELL_PADDING = 10;

function useFitScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setScale(Math.min(1, element.clientWidth / gridWidthPx) || 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, scale };
}

function PanelCell({ item }: { item: PanelItem }) {
  const box = cellBox(item);
  const width = cellsToPx(box.cols);
  const height = cellsToPx(box.rows);
  const style: CSSProperties = { left: box.col * (GRID_CELL_PX + GRID_GAP_PX), top: box.row * (GRID_CELL_PX + GRID_GAP_PX), width, height };
  return (
    <div className="custom-panel__cell" style={style} data-widget={item.widget} data-size={item.size}>
      <SlotView
        slot={widgetSlot}
        props={{ size: item.size, width: width - CELL_PADDING * 2, height: height - CELL_PADDING * 2 }}
        select={(items) => items.filter((entry) => entry.id === item.widget && entry.sizes.includes(item.size)).slice(0, 1)}
      />
    </div>
  );
}

export function CustomPanelPage({ panelId }: { panelId: string }) {
  const t = useTranslation().islandWidgets.panel;
  const { panels } = useCustomPanels();
  const { ref, scale } = useFitScale();
  const panel = panels.find((candidate) => candidate.id === panelId);
  const items = panel?.items ?? [];
  const rows = gridRows(items);
  if (items.length === 0) {
    return (
      <div className="custom-panel custom-panel--empty" ref={ref}>
        <p>{t.empty}</p>
        <button className="custom-panel__settings" type="button" onClick={() => openSettingsWindow("islandLayout")}>
          {t.openSettings}
        </button>
      </div>
    );
  }
  const gridStyle: CSSProperties = { width: gridWidthPx, height: cellsToPx(rows), zoom: scale };
  return (
    <div className="custom-panel" ref={ref} data-panel={panelId}>
      <div className="custom-panel__grid" style={gridStyle}>
        {items.map((item, index) => <PanelCell key={`${item.widget}-${index}`} item={item} />)}
      </div>
    </div>
  );
}
