import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Puzzle } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { cellBox, cellsToPx, GRID_CELL_PX, GRID_GAP_PX, gridRows, gridWidthPx, type CustomPanel } from "../../../lib/settings/customPanels";
import type { IslandPageRow } from "./useIslandPageRows";
import type { WidgetLibrary } from "./useWidgetLibrary";

const ISLAND_PADDING = 14;
const VISIBLE_ROWS = 4;
const STEP = GRID_CELL_PX + GRID_GAP_PX;
const ISLAND_WIDTH = gridWidthPx + ISLAND_PADDING * 2;

function useFitScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setScale(Math.min(1, element.clientWidth / ISLAND_WIDTH) || 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, scale };
}

type ExpandedPreviewProps = {
  rows: readonly IslandPageRow[];
  current: IslandPageRow | undefined;
  panel: CustomPanel | undefined;
  library: WidgetLibrary;
  selected: string | undefined;
  onPage: (id: string) => void;
  onWidget: (id: string) => void;
};

function PanelGrid({ panel, library, selected, onWidget }: { panel: CustomPanel; library: WidgetLibrary; selected: string | undefined; onWidget: (id: string) => void }) {
  const t = useTranslation();
  const text = t.settings.islandPages;
  if (panel.items.length === 0) return <p className="expanded-preview__empty">{text.preview.empty}</p>;
  const rows = gridRows(panel.items);
  return (
    <div className="expanded-preview__scroll" style={{ maxHeight: cellsToPx(VISIBLE_ROWS) }}>
      <div className="expanded-preview__grid" style={{ width: gridWidthPx, height: cellsToPx(rows) }}>
        {panel.items.map((item) => {
          const box = cellBox(item);
          const widget = library.find(item.widget);
          const Icon = widget?.icon ?? Puzzle;
          const name = widget?.name ?? item.widget;
          const style: CSSProperties = { left: box.col * STEP, top: box.row * STEP, width: cellsToPx(box.cols), height: cellsToPx(box.rows) };
          return (
            <button
              key={item.widget}
              className="expanded-preview__cell"
              type="button"
              style={style}
              data-widget={item.widget}
              data-size={item.size}
              data-off={widget?.available ? undefined : true}
              aria-pressed={item.widget === selected}
              onClick={() => onWidget(item.widget)}
            >
              <Icon size={box.rows > 1 || box.cols > 1 ? 22 : 18} strokeWidth={1.8} aria-hidden="true" />
              <strong>{name}</strong>
              <small>{widget?.available ? t.islandWidgets.sizes[item.size] : text.panels.unavailable}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ExpandedPreview({ rows, current, panel, library, selected, onPage, onWidget }: ExpandedPreviewProps) {
  const text = useTranslation().settings.islandPages;
  const { ref, scale } = useFitScale();
  const tabs = rows.filter((row) => !row.hidden && !row.off);
  const CurrentIcon = current?.icon;
  return (
    <div className="expanded-preview" ref={ref}>
      <div className="expanded-preview__island" style={{ width: ISLAND_WIDTH, zoom: scale }}>
        <div className="expanded-preview__head">
          {tabs.map((row) => {
            const Icon = row.icon;
            const on = row.id === current?.id;
            return (
              <button key={row.id} className="expanded-preview__tab" type="button" data-page={row.id} aria-pressed={on} aria-label={row.name} title={row.name} onClick={() => onPage(row.id)}>
                <Icon size={13} strokeWidth={2} aria-hidden="true" />
                {on ? <span>{row.name}</span> : null}
              </button>
            );
          })}
        </div>
        {panel ? (
          <PanelGrid panel={panel} library={library} selected={selected} onWidget={onWidget} />
        ) : current && CurrentIcon ? (
          <div className="expanded-preview__page" data-page={current.id}>
            <CurrentIcon size={24} strokeWidth={1.6} aria-hidden="true" />
            <strong>{current.name}</strong>
            <span>{current.off ? text.preview.off : text.preview.builtin}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
