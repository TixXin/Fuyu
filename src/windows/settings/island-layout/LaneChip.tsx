import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";
import { Palette, Plus, X } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { ItemGlyph } from "./IslandBarPreview";

export type ChipKind = "bar" | "center" | "off";

export function LaneChip({ id, name, place, kind, selected, picked, dragging, spilled, styled, onPointerDown, onSelect, onKeyDown, onMenu, onRemove, onRestore, onStyle }: {
  id: string;
  name: string;
  place: string;
  kind: ChipKind;
  selected: boolean;
  picked: boolean;
  dragging: boolean;
  spilled: boolean;
  styled: boolean;
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onSelect: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  onMenu?: (x: number, y: number) => void;
  onRemove?: () => void;
  onRestore?: () => void;
  onStyle?: () => void;
}) {
  const text = useTranslation().settings.collapsedItems;
  const lanes = text.lanes;
  const menu = (event: MouseEvent<HTMLElement>) => {
    if (!onMenu) return;
    event.preventDefault();
    onMenu(event.clientX, event.clientY);
  };
  return (
    <span
      className={`layout-chip lane-chip${kind === "off" ? " layout-chip--add" : ""}`}
      data-item={id}
      data-kind={kind}
      data-picked={picked || undefined}
      data-dragging={dragging || undefined}
      data-spilled={spilled || undefined}
      tabIndex={0}
      role="option"
      aria-selected={selected}
      aria-label={lanes.chip(name, place)}
      title={spilled ? lanes.spilled : undefined}
      onPointerDown={onPointerDown}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      onContextMenu={menu}
    >
      {kind === "off" ? (
        <button className="layout-chip__plus lane-chip__restore" type="button" aria-label={lanes.restore(name)} title={lanes.restoreTitle(place)} onClick={(event) => { event.stopPropagation(); onRestore?.(); }}>
          <Plus size={14} strokeWidth={2.4} />
        </button>
      ) : null}
      <span className="layout-chip__icon lane-chip__icon" aria-hidden="true"><ItemGlyph id={id} /></span>
      <span className="layout-chip__name">{name}</span>
      {spilled ? <span className="layout-chip__badge lane-chip__tag">+N</span> : null}
      {styled && kind !== "off" ? (
        <button className="layout-chip__action lane-chip__style" type="button" tabIndex={-1} aria-label={text.styleOf(name)} title={lanes.styles} onClick={(event) => { event.stopPropagation(); onStyle?.(); }}>
          <Palette size={13} strokeWidth={2.2} />
        </button>
      ) : null}
      {kind === "bar" ? (
        <button className="layout-chip__action lane-chip__remove" type="button" aria-label={lanes.remove(name)} title={lanes.removeTitle} onClick={(event) => { event.stopPropagation(); onRemove?.(); }}>
          <X size={13} strokeWidth={2.4} />
        </button>
      ) : null}
    </span>
  );
}
