import { Fragment, useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { useTranslation } from "../../../i18n";
import type { CollapsedPlacement } from "../../../lib/settings/collapsedItems";
import { useCollapsedOverflowIds } from "../../../lib/settings/useCollapsedOverflowIds";
import { ChipMenu } from "./ChipMenu";
import { firstSpilled, laneIds, laneOf, type LaneId, type StepKey } from "./laneMoves";
import { LaneChip, type ChipKind } from "./LaneChip";
import type { CollapsedEditor } from "./useCollapsedEditor";
import type { CollapsedLayout } from "./useCollapsedLayout";
import "./CollapsedLanes.css";

type BarLane = "left" | "center" | "right" | "shelf";
const LANES: readonly BarLane[] = ["left", "center", "right", "shelf"];
const ARROWS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

function findChip(root: HTMLElement | null, id: string) {
  return root?.querySelector<HTMLElement>(`.lane-chip[data-item='${CSS.escape(id)}']`) ?? null;
}

function Pict({ lane }: { lane: BarLane }) {
  const parts = lane === "shelf" ? ["", "m", "", "on"] : ["left", "center", "right"].map((part) => [part === "center" ? "m" : "", part === lane ? "on" : ""].filter(Boolean).join(" "));
  return (
    <span className="collapsed-lanes__pict" data-lane={lane} aria-hidden="true">
      {parts.map((part, index) => <i key={index} className={part || undefined} />)}
    </span>
  );
}

export function CollapsedLanes({ layout, editor, notch, centers, styled, selected, onSelect, onStyle }: {
  layout: CollapsedLayout;
  notch: boolean;
  editor: CollapsedEditor;
  centers: readonly string[];
  styled: (id: string) => boolean;
  selected: string | null;
  onSelect: (id: string) => void;
  onStyle: (id: string) => void;
}) {
  const t = useTranslation().settings.collapsedItems;
  const text = t.lanes;
  const { names, saved } = layout;
  const { view, listed, drag, picked, history } = editor;
  const noRoom = useCollapsedOverflowIds();
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const centerName: Record<string, string> = { center: t.item.center, "todos-count": t.item.todoCount };
  const name = (id: string) => names.get(id) ?? centerName[id] ?? id;
  const hint = (lane: BarLane) => lane === "shelf" || !notch ? text.laneHint[lane] : text.notchHint[lane];

  useLayoutEffect(() => {
    const id = editor.takeFocus();
    const chip = id ? findChip(root.current, id) : null;
    if (chip && document.activeElement !== chip) chip.focus();
  });

  const closeMenu = useCallback((refocus: boolean) => {
    setMenu((open) => {
      if (open && refocus) window.setTimeout(() => findChip(root.current, open.id)?.focus(), 0);
      return null;
    });
  }, []);

  const openMenu = (id: string, x: number, y: number) => {
    onSelect(id);
    setMenu({ id, x, y });
  };

  const keys = (id: string, kind: ChipKind) => (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (kind === "bar" && (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) {
      event.preventDefault();
      const box = event.currentTarget.getBoundingClientRect();
      openMenu(id, box.left, box.bottom + 6);
      return;
    }
    if (kind === "center") {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onStyle(id);
      }
      return;
    }
    if (event.key === "Escape") {
      if (editor.cancelPick()) event.preventDefault();
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && kind === "bar") {
      event.preventDefault();
      editor.move(id, "off");
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (kind === "off") editor.restore(id);
      else editor.pickUp(id);
      return;
    }
    if (!ARROWS.has(event.key) || (picked !== id && !event.altKey)) return;
    event.preventDefault();
    editor.step(id, event.key as StepKey, picked !== id);
  };

  const chip = (placement: CollapsedPlacement | null, id: string, kind: ChipKind, spilled = false) => {
    const lane = placement ? laneOf(placement) : "center";
    const back: LaneId = placement?.shelf ? "shelf" : (placement?.zone ?? "right");
    return (
      <LaneChip
        key={id}
        id={id}
        name={name(id)}
        place={text.name[kind === "off" ? back : lane]}
        kind={kind}
        selected={selected === id}
        picked={picked === id}
        dragging={drag?.id === id}
        spilled={spilled}
        styled={styled(id)}
        onPointerDown={kind === "center" ? undefined : (event) => editor.startDrag(event, id)}
        onSelect={() => onSelect(id)}
        onKeyDown={keys(id, kind)}
        onMenu={kind === "bar" ? (x, y) => openMenu(id, x, y) : undefined}
        onRemove={() => editor.move(id, "off")}
        onRestore={() => editor.restore(id)}
        onStyle={() => onStyle(id)}
      />
    );
  };

  const byId = new Map(view.map((placement) => [placement.id, placement]));
  const laneChips = (lane: BarLane) => {
    if (lane === "center") return centers.map((id) => chip(null, id, "center"));
    const ids = laneIds(view, lane, listed);
    const fold = lane === "shelf" ? null : firstSpilled(ids, noRoom);
    let folded = false;
    return ids.map((id) => {
      if (id === fold) folded = true;
      return (
        <Fragment key={id}>
          {id === fold ? <span className="collapsed-lanes__fold">{text.fold}</span> : null}
          {chip(byId.get(id) ?? null, id, "bar", folded)}
        </Fragment>
      );
    });
  };

  const over = (lane: string) => {
    if (!drag) return undefined;
    if (drag.lane === lane) return lane === "center" ? "deny" : "drop";
    return lane === "center" ? "no" : "yes";
  };
  const off = laneIds(view, "off", listed);
  const onBar = ["left", "right", "shelf"].reduce((count, lane) => count + laneIds(view, lane as LaneId, listed).length, 0);
  const menuItem = menu ? byId.get(menu.id) : undefined;

  return (
    <SettingsGroup title={t.title} footer={t.hint}>
      <div className="collapsed-lanes" ref={root} data-dragging={drag ? "" : undefined} data-notch={notch || undefined}>
        <p className="collapsed-lanes__keys">{text.keys}</p>
        <div className="collapsed-lanes__bucket">
          <header className="collapsed-lanes__head">
            <span className="collapsed-lanes__shape" aria-hidden="true" />
            {text.onBar}
            <span className="collapsed-lanes__count">{onBar}</span>
          </header>
          <div className="collapsed-lanes__lanes">
            {LANES.filter((lane) => lane !== "center" || centers.length > 0).map((lane) => {
              const chips = laneChips(lane);
              return (
                <div key={lane} className="collapsed-lanes__lane" data-lane={lane} data-over={over(lane)}>
                  <div className="collapsed-lanes__lane-head">
                    <Pict lane={lane} />
                    <b>{text.name[lane]}</b>
                    <span className="collapsed-lanes__lane-hint" title={hint(lane)}>{drag?.lane === lane && lane === "center" ? text.denyCenter : hint(lane)}</span>
                  </div>
                  <div className="collapsed-lanes__list" role="listbox" aria-label={text.name[lane]}>
                    {chips.length > 0 ? chips : <span className="collapsed-lanes__none">{text.dropHere}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="collapsed-lanes__bucket collapsed-lanes__off" data-lane="off" data-over={drag?.lane === "off" ? "drop" : undefined}>
          <header className="collapsed-lanes__head">
            <span className="collapsed-lanes__shape" data-dashed="" aria-hidden="true" />
            {text.name.off}
            <span className="collapsed-lanes__count">{off.length}</span>
            <span className="collapsed-lanes__drop-tip">{text.offDrop}</span>
          </header>
          <div className="collapsed-lanes__list" role="listbox" aria-label={text.name.off}>
            {off.length > 0 ? off.map((id) => chip(byId.get(id) ?? null, id, "off")) : <span className="collapsed-lanes__none">{text.allOn}</span>}
          </div>
        </div>
        <button className="layout-chips__reset collapsed-lanes__reset" type="button" disabled={saved.length === 0} onClick={editor.reset}>
          {t.reset}
        </button>
        <p className="collapsed-lanes__live" aria-live="polite">{history.said}</p>
      </div>
      {menu && menuItem ? (
        <ChipMenu
          lane={laneOf(menuItem)}
          x={menu.x}
          y={menu.y}
          styled={styled(menu.id)}
          onPlace={(lane) => editor.move(menu.id, lane)}
          onStyle={() => onStyle(menu.id)}
          onOff={() => editor.move(menu.id, "off")}
          onClose={closeMenu}
        />
      ) : null}
      {history.notice ? (
        <div className="lane-toast" role="status" key={history.notice.key}>
          <span>{history.notice.text}</span>
          {history.notice.undo && history.canUndo ? (
            <button type="button" onClick={history.undo}>{text.undo}</button>
          ) : null}
        </div>
      ) : null}
    </SettingsGroup>
  );
}
