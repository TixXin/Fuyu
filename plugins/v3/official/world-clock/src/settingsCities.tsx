import { useState } from "react";
import { CitySearch } from "./citySearch.tsx";
import { GripIcon, PencilIcon, StarIcon, XIcon } from "./icons.tsx";
import { MAX_NAME, METHODS, cityLabel, primaryCity, type WorldCity } from "./model.ts";
import { text } from "./text.ts";
import { useDragSort } from "./useDragSort.ts";

type Invoke = (method: string, params?: unknown) => void;

function CityRow({
  city,
  focused,
  dragging,
  handle,
  invoke,
}: {
  city: WorldCity;
  focused: boolean;
  dragging: boolean;
  handle: ReturnType<ReturnType<typeof useDragSort>["handleProps"]>;
  invoke: Invoke;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const label = cityLabel(city, text.isZh);

  function finish(save: boolean) {
    if (save) invoke(METHODS.rename, { id: city.id, name: draft });
    setEditing(false);
  }

  return (
    <li data-sort-row={city.id} className={dragging ? "fuyu-world-clock-set__city is-dragging" : "fuyu-world-clock-set__city"}>
      <span className="fuyu-world-clock-set__grip" role="button" tabIndex={0} aria-label={`${text.moveUp} / ${text.moveDown}`} {...handle}>
        <GripIcon />
      </span>
      {editing ? (
        <input
          autoFocus
          className="fuyu-world-clock-set__input fuyu-world-clock-set__rename"
          value={draft}
          maxLength={MAX_NAME}
          placeholder={text.isZh ? city.labelZh : city.labelEn}
          aria-label={text.renamePlaceholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => finish(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") finish(true);
            if (e.key === "Escape") finish(false);
          }}
        />
      ) : (
        <span className="fuyu-world-clock-set__name" title={label}>
          {label}
        </span>
      )}
      <span className="fuyu-world-clock-set__zone" title={city.timeZone}>
        {city.timeZone}
      </span>
      <button
        type="button"
        className="fuyu-world-clock-set__icon"
        title={text.rename}
        aria-label={text.rename}
        onClick={() => {
          setDraft(city.name ?? "");
          setEditing(true);
        }}
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        className={focused ? "fuyu-world-clock-set__icon fuyu-world-clock-set__star is-on" : "fuyu-world-clock-set__icon fuyu-world-clock-set__star"}
        title={text.focus}
        aria-label={text.focus}
        aria-pressed={focused}
        onClick={() => invoke(METHODS.focus, { id: city.id })}
      >
        <StarIcon filled={focused} />
      </button>
      <button
        type="button"
        className="fuyu-world-clock-set__icon"
        title={text.remove}
        aria-label={text.remove}
        onClick={() => invoke(METHODS.remove, { id: city.id })}
      >
        <XIcon />
      </button>
    </li>
  );
}

export function CityList({ cities, invoke }: { cities: readonly WorldCity[]; invoke: Invoke }) {
  const ids = cities.map((city) => city.id);
  const sort = useDragSort(ids, (id, to) => invoke(METHODS.move, { id, to }));
  const byId = new Map(cities.map((city) => [city.id, city]));
  const focusedId = primaryCity(cities)?.id;
  return (
    <>
      <CitySearch cities={cities} invoke={invoke} />
      <ul className="fuyu-world-clock-set__cities" ref={sort.listRef}>
        {sort.order.map((id) => {
          const city = byId.get(id);
          if (!city) return null;
          return (
            <CityRow
              key={id}
              city={city}
              focused={id === focusedId}
              dragging={sort.dragging === id}
              handle={sort.handleProps(id)}
              invoke={invoke}
            />
          );
        })}
      </ul>
    </>
  );
}
