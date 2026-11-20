import { FolderInput } from "lucide-react";
import { WidgetEmpty, WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import { shelfIsland } from "./islandState";
import { SHELF_WIDGET } from "./widgets.ts";

const ROW_PX = 22;
const HEAD_PX = 50;

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

function ShelfWidget({ size, height }: IslandWidgetProps) {
  const t = useTranslation().islandWidgets;
  const items = shelfIsland.use().shelf?.items ?? [];
  const names = items.slice(0, size === "s" ? 1 : Math.max(1, Math.floor((height - HEAD_PX) / ROW_PX)));
  return (
    <WidgetFrame icon={FolderInput} title={t.widgets.shelf}>
      {items.length === 0 ? (
        <WidgetEmpty>{t.content.shelfEmpty}</WidgetEmpty>
      ) : (
        <>
          <span className="island-widget__big">{t.content.shelfCount(items.length)}</span>
          {names.map((item) => <span key={item.id} className="island-widget__sub" title={item.path}>{item.name}</span>)}
        </>
      )}
    </WidgetFrame>
  );
}

widgetSlot.add({ ...SHELF_WIDGET, component: ShelfWidget }, SHELF_WIDGET.owner);
