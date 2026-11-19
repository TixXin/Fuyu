import { useState } from "react";
import { GripIcon, PencilIcon, StarIcon, XIcon } from "./icons.tsx";
import { ItemForm, type Invoke } from "./itemForm.tsx";
import { rowLabel } from "./labels.ts";
import { MAX_ITEMS, METHODS, readingOf, type CountdownItem } from "./model.ts";
import { text } from "./text.ts";
import { useDragSort } from "./useDragSort.ts";

function describe(item: CountdownItem, at: number): string {
  const parts = [item.date, item.kind === "anniversary" ? text.kindAnniversary : "", item.repeat ? text.repeatShort : "", rowLabel(readingOf(item, at))];
  return parts.filter(Boolean).join(" · ");
}

function ItemRow({
  item,
  at,
  dragging,
  handle,
  invoke,
  onError,
}: {
  item: CountdownItem;
  at: number;
  dragging: boolean;
  handle: ReturnType<ReturnType<typeof useDragSort>["handleProps"]>;
  invoke: Invoke;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <li data-sort-row={item.id} className={dragging ? "fuyu-countdown-set__item is-dragging" : "fuyu-countdown-set__item"}>
      <div className="fuyu-countdown-set__item-row">
        <span className="fuyu-countdown-set__grip" role="button" tabIndex={0} aria-label={text.move} {...handle}>
          <GripIcon />
        </span>
        <div className="fuyu-countdown-set__item-text">
          <span className="fuyu-countdown-set__name" title={item.title}>
            {item.title}
          </span>
          <span className="fuyu-countdown-set__sub">{describe(item, at)}</span>
        </div>
        <button
          type="button"
          className={editing ? "fuyu-countdown-set__icon is-on" : "fuyu-countdown-set__icon"}
          title={text.edit}
          aria-label={text.edit}
          aria-expanded={editing}
          onClick={() => setEditing(!editing)}
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          className={item.pinned ? "fuyu-countdown-set__icon fuyu-countdown-set__star is-on" : "fuyu-countdown-set__icon fuyu-countdown-set__star"}
          title={text.pin}
          aria-label={text.pin}
          aria-pressed={item.pinned}
          onClick={() => invoke(METHODS.pin, { id: item.id })}
        >
          <StarIcon filled={item.pinned} />
        </button>
        <button type="button" className="fuyu-countdown-set__icon" title={text.remove} aria-label={text.remove} onClick={() => invoke(METHODS.remove, { id: item.id })}>
          <XIcon />
        </button>
      </div>
      {editing && <ItemForm item={item} invoke={invoke} onDone={() => setEditing(false)} onError={onError} />}
    </li>
  );
}

export function ItemList({
  items,
  at,
  invoke,
  onError,
}: {
  items: readonly CountdownItem[];
  at: number;
  invoke: Invoke;
  onError: (message: string) => void;
}) {
  const ids = items.map((item) => item.id);
  const sort = useDragSort(ids, (id, to) => invoke(METHODS.move, { id, to }));
  const byId = new Map(items.map((item) => [item.id, item]));
  const full = items.length >= MAX_ITEMS;
  return (
    <>
      <ItemForm invoke={invoke} onError={onError} disabled={full} />
      {full && <p className="fuyu-countdown-set__hint is-warn">{text.full(MAX_ITEMS)}</p>}
      {items.length === 0 ? (
        <p className="fuyu-countdown-set__hint">{text.noItems}</p>
      ) : (
        <ul className="fuyu-countdown-set__items" ref={sort.listRef}>
          {sort.order.map((id) => {
            const item = byId.get(id);
            if (!item) return null;
            return (
              <ItemRow
                key={id}
                item={item}
                at={at}
                dragging={sort.dragging === id}
                handle={sort.handleProps(id)}
                invoke={invoke}
                onError={onError}
              />
            );
          })}
        </ul>
      )}
    </>
  );
}
