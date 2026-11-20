import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { cellBox, cellsToPx, GRID_VISIBLE_ROWS, gridRows, gridWidthPx, removePanelItem, resizePanelItem, type CustomPanel, type PanelSize } from "../../../lib/settings/customPanels";
import { STEP_PX, usePanelDrag } from "./usePanelDrag";

type PanelCanvasProps = {
  panel: CustomPanel;
  nameOf: (id: string) => string;
  available: ReadonlySet<string>;
  sizesOf: (id: string) => readonly PanelSize[];
  onChange: (panel: CustomPanel) => void;
};

function useCanvasScale() {
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

export function PanelCanvas({ panel, nameOf, available, sizesOf, onChange }: PanelCanvasProps) {
  const t = useTranslation();
  const text = t.settings.islandPages.panels;
  const sizes = t.islandWidgets.sizes;
  const { ref, scale } = useCanvasScale();
  const { drag, handlers } = usePanelDrag(panel, scale, onChange);
  const rows = Math.max(1, gridRows(panel.items) + (drag ? 1 : 0));
  const gridStyle: CSSProperties = { width: gridWidthPx, height: cellsToPx(rows), zoom: scale };

  return (
    <div className="panel-canvas" ref={ref}>
      <div className="panel-canvas__grid" style={gridStyle} data-rows={rows}>
        <div className="panel-canvas__fold" style={{ top: cellsToPx(GRID_VISIBLE_ROWS) + 4 }} hidden={rows <= GRID_VISIBLE_ROWS} />
        {panel.items.map((item, index) => {
          const box = cellBox(item);
          const name = nameOf(item.widget);
          const moving = drag?.index === index;
          const style: CSSProperties = {
            left: box.col * STEP_PX,
            top: box.row * STEP_PX,
            width: cellsToPx(box.cols),
            height: cellsToPx(box.rows),
            transform: moving ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined,
          };
          const choices = sizesOf(item.widget);
          return (
            <div
              key={`${item.widget}-${index}`}
              className="panel-canvas__item"
              style={style}
              tabIndex={0}
              role="group"
              aria-label={text.moveWidget(name)}
              data-widget={item.widget}
              data-moving={moving || undefined}
              data-unavailable={available.has(item.widget) ? undefined : true}
              {...handlers(index)}
            >
              <span className="panel-canvas__name">{name}</span>
              <span className="panel-canvas__size">{available.has(item.widget) ? sizes[item.size] : text.unavailable}</span>
              {choices.length > 1 ? (
                <span className="panel-canvas__sizes">
                  {choices.map((size) => (
                    <button key={size} type="button" aria-pressed={size === item.size} aria-label={`${name} · ${sizes[size]}`} onClick={() => onChange(resizePanelItem(panel, index, size))}>
                      {sizes[size]}
                    </button>
                  ))}
                </span>
              ) : null}
              <button className="panel-canvas__remove" type="button" aria-label={text.removeWidget(name)} onClick={() => onChange(removePanelItem(panel, index))}>
                <X size={12} strokeWidth={2.4} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
