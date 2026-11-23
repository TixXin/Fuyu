import { ClipboardList } from "lucide-react";
import { clickOnly } from "../../../components/island-widget/clickOnly";
import { useWidgetFlash } from "../../../components/island-widget/useWidgetFlash";
import { WidgetEmpty, WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { WidgetOpenButton } from "../../../components/island-widget/WidgetOpenButton";
import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import type { ClipboardHistoryItem } from "../api";
import { clipboardIsland } from "./islandState";
import { CLIPBOARD_WIDGET } from "./widgets.ts";
import "./widget.css";

const ROW_PX = 26;
const HEAD_PX = 22;

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

function ClipboardWidget({ height }: IslandWidgetProps) {
  const t = useTranslation().islandWidgets;
  const island = clipboardIsland.use();
  const clipboard = island?.clipboard;
  const { flash, track } = useWidgetFlash();
  const all = clipboard?.clipboardHistory.items ?? [];
  const items = all.slice(0, Math.max(1, Math.floor((height - HEAD_PX) / ROW_PX)));
  const text = (item: ClipboardHistoryItem) =>
    item.kind === "image" ? t.content.image : item.kind === "files" ? t.content.files(item.files?.length ?? 0) : (item.preview || item.text || "").replace(/\s+/g, " ");
  const copy = (item: ClipboardHistoryItem) => {
    if (clipboard) void track(() => clipboard.copyClipboardHistoryItem(item.id), { done: t.content.copied });
  };
  const aside = island ? <WidgetOpenButton label={t.content.openClipboard} onOpen={island.openPage} /> : null;
  return (
    <WidgetFrame icon={ClipboardList} title={t.widgets.clipboard} aside={aside} flash={flash}>
      {items.length === 0 ? (
        <WidgetEmpty>{t.content.clipboardEmpty}</WidgetEmpty>
      ) : (
        <ul className="island-widget__list">
          {items.map((item) => (
            <li key={item.id}>
              <button className="clipboard-widget__item" type="button" title={`${text(item)}\n${t.content.clipboardCopyHint}`} onClick={clickOnly(() => copy(item))}>
                {text(item)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

widgetSlot.add({ ...CLIPBOARD_WIDGET, component: ClipboardWidget }, CLIPBOARD_WIDGET.owner);
