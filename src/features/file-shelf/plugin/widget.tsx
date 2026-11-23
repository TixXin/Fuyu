import { FolderInput, FolderOpen } from "lucide-react";
import { clickOnly } from "../../../components/island-widget/clickOnly";
import { useWidgetFlash } from "../../../components/island-widget/useWidgetFlash";
import { WidgetEmpty, WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { WidgetOpenButton } from "../../../components/island-widget/WidgetOpenButton";
import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import type { FileShelfItem } from "../api";
import { FileShelfItemIcon } from "../FileShelfItemIcon";
import { shelfIsland } from "./islandState";
import { useDragOut } from "./useDragOut";
import { SHELF_WIDGET } from "./widgets.ts";
import "./widget.css";

const ROW_PX = 24;
const HEAD_PX = 24;
const STACK = 3;
const ALL = "*";

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

const available = (item: FileShelfItem) => !item.missing && !item.unreachable;

function ShelfWidget({ size, height }: IslandWidgetProps) {
  const t = useTranslation().islandWidgets;
  const { shelf, enabled, openPage } = shelfIsland.use();
  const { flash, track } = useWidgetFlash();
  const items = shelf?.items ?? [];
  const drag = useDragOut((key) => {
    const ids = key === ALL ? items.filter(available).map((item) => item.id) : [key];
    if (ids.length > 0) void shelf?.startDrag(ids);
  });
  const open = (item: FileShelfItem) => {
    if (shelf && available(item)) void track(() => shelf.open(item.id));
  };
  const reveal = (item: FileShelfItem) => {
    if (shelf) void track(() => shelf.reveal(item.id));
  };
  const fit = Math.max(1, Math.floor((height - HEAD_PX) / ROW_PX));
  const shown = items.length > fit ? items.slice(0, fit - 1) : items;
  const more = items.length - shown.length;
  const aside = enabled && openPage ? <>{size !== "s" && items.length > 0 ? items.length : null}<WidgetOpenButton label={t.content.openShelf} onOpen={openPage} /></> : null;
  return (
    <WidgetFrame icon={FolderInput} title={t.widgets.shelf} aside={aside} className="shelf-widget" flash={flash}>
      {!enabled ? (
        <WidgetEmpty>{t.content.shelfOff}</WidgetEmpty>
      ) : items.length === 0 ? (
        <WidgetEmpty>{t.content.shelfEmpty}</WidgetEmpty>
      ) : size === "s" ? (
        <button
          className="shelf-widget__stack"
          type="button"
          title={t.content.shelfStackHint}
          aria-label={`${t.content.shelfCount(items.length)}. ${t.content.openShelf}`}
          onPointerDown={drag.press(ALL)}
          onPointerMove={drag.move}
          onPointerUp={drag.release}
          onClick={clickOnly(() => {
            if (!drag.wasDragged()) openPage?.();
          })}
        >
          <span className="shelf-widget__icons" aria-hidden="true">
            {items.slice(0, STACK).map((item) => <FileShelfItemIcon key={item.id} id={item.id} name={item.name} isDir={item.isDir} available={available(item)} />)}
          </span>
          <span className="shelf-widget__count">{t.content.shelfCount(items.length)}</span>
        </button>
      ) : (
        <ul className="island-widget__list shelf-widget__list">
          {shown.map((item) => (
            <li key={item.id} className="shelf-widget__row" data-missing={available(item) ? undefined : ""}>
              <button
                className="shelf-widget__item"
                type="button"
                title={available(item) ? `${item.path}\n${t.content.shelfItemHint}` : item.path}
                onPointerDown={available(item) ? drag.press(item.id) : (event) => event.stopPropagation()}
                onPointerMove={drag.move}
                onPointerUp={drag.release}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={clickOnly(() => open(item))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") open(item);
                }}
              >
                <FileShelfItemIcon id={item.id} name={item.name} isDir={item.isDir} available={available(item)} />
                <span>{item.name}</span>
              </button>
              {available(item) ? (
                <button className="shelf-widget__reveal" type="button" aria-label={t.content.revealFile} title={t.content.revealFile} onClick={clickOnly(() => reveal(item))}>
                  <FolderOpen size={12} strokeWidth={2.2} aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
          {more > 0 ? (
            <li>
              <button className="shelf-widget__more" type="button" onClick={clickOnly(() => openPage?.())}>{t.content.shelfMore(more)}</button>
            </li>
          ) : null}
        </ul>
      )}
    </WidgetFrame>
  );
}

widgetSlot.add({ ...SHELF_WIDGET, component: ShelfWidget }, SHELF_WIDGET.owner);
