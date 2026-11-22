import { Plus } from "lucide-react";
import type { WidgetLibrary } from "../../../../features/plugin-kernel/widgetLibrary";
import { useTranslation } from "../../../../i18n";
import { cellBox, itemBoxPx, type CustomPanel } from "../../../../lib/settings/customPanels";
import "./PanelOverview.css";

const GAP_X = 14;
const GAP_Y = 24;
const PAD = 12;

type OverviewProps = {
  panel: CustomPanel;
  pageCount: number;
  pageColumns: number;
  pageStepPx: number;
  viewWidth: number;
  boardHeight: number;
  room: { width: number; height: number };
  canAdd: boolean;
  target: { widget: string; page: number } | null;
  pushed: ReadonlySet<string>;
  library: WidgetLibrary;
};

function sheetLayout(count: number, room: OverviewProps["room"], viewWidth: number, boardHeight: number) {
  let best = { columns: 1, rows: count, scale: 0 };
  for (let columns = 1; columns <= count; columns += 1) {
    const rows = Math.ceil(count / columns);
    const scale = Math.min((room.width - PAD * 2 - (columns - 1) * GAP_X) / (columns * viewWidth), (room.height - PAD * 2 - (rows - 1) * GAP_Y - 14) / (rows * boardHeight), 0.6);
    if (scale > best.scale) best = { columns, rows, scale };
  }
  return best;
}

export function PanelOverview({ panel, pageCount, pageColumns, pageStepPx, viewWidth, boardHeight, room, canAdd, target, pushed, library }: OverviewProps) {
  const t = useTranslation().islandWidgets.panel.paging;
  const count = pageCount + (canAdd ? 1 : 0);
  const { columns, rows, scale } = sheetLayout(count, room, viewWidth, boardHeight);
  const width = viewWidth * scale;
  const height = boardHeight * scale;
  const originX = (room.width - (columns * width + (columns - 1) * GAP_X)) / 2;
  const originY = (room.height - (rows * height + (rows - 1) * GAP_Y)) / 2 + 7;
  return (
    <div className="panel-overview" aria-hidden="true">
      {Array.from({ length: count }, (_, page) => {
        const fresh = page >= pageCount;
        const style = { left: originX + (page % columns) * (width + GAP_X), top: originY + Math.floor(page / columns) * (height + GAP_Y), width, height };
        return (
          <div key={page} className="panel-overview__sheet" style={style} data-panel-drop="sheet" data-index={page} data-hot={target?.page === page || undefined} data-fresh={fresh || undefined}>
            {fresh ? (
              <span className="panel-overview__new">
                <Plus size={13} strokeWidth={2.2} />
                {t.newPage}
              </span>
            ) : (
              <span className="panel-overview__no">{t.goTo(page + 1)}</span>
            )}
            {panel.items
              .filter((item) => Math.floor(cellBox(item).col / pageColumns) === page)
              .map((item) => {
                const box = itemBoxPx(panel, item);
                const widget = library.find(item.widget);
                const Icon = widget?.icon;
                const tone = item.widget === target?.widget ? "target" : pushed.has(item.widget) ? "pushed" : undefined;
                const cardWidth = box.width * scale - 2;
                return (
                  <i
                    key={item.widget}
                    className="panel-overview__card"
                    data-tone={tone}
                    style={{ left: (box.left - page * pageStepPx) * scale, top: box.top * scale, width: cardWidth, height: box.height * scale - 2 }}
                  >
                    {tone === "target" || !Icon ? null : <Icon size={13} strokeWidth={1.9} aria-hidden="true" />}
                    {tone !== "target" && cardWidth > 70 ? <span>{widget?.name}</span> : null}
                  </i>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
