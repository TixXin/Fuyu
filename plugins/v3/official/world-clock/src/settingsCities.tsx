import { useMemo, useState } from "react";
import { searchCities, type SearchResult } from "./cities.ts";
import { GripIcon, PencilIcon, StarIcon, XIcon } from "./icons.tsx";
import { MAX_CITIES, MAX_NAME, METHODS, cityLabel, primaryCity, type WorldCity } from "./model.ts";
import { text } from "./text.ts";
import { useDragSort } from "./useDragSort.ts";

type Invoke = (method: string, params?: unknown) => void;

function CitySearch({ cities, invoke }: { cities: readonly WorldCity[]; invoke: Invoke }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(() => (open ? searchCities(query, 30) : []), [open, query]);
  const full = cities.length >= MAX_CITIES;
  const isAdded = (item: SearchResult) =>
    cities.some((city) => city.timeZone === item.timeZone && city.labelEn === item.en);

  function add(item: SearchResult) {
    if (full || isAdded(item)) return;
    invoke(METHODS.add, { timeZone: item.timeZone, labelZh: item.zh, labelEn: item.en, shortCode: item.code });
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="fuyu-world-clock-set__search">
      <input
        type="search"
        className="fuyu-world-clock-set__input"
        placeholder={text.searchPlaceholder}
        value={query}
        disabled={full}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) add(results[0]);
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {full && <p className="fuyu-world-clock-set__hint">{text.full(MAX_CITIES)}</p>}
      {open && !full && (
        <ul className="fuyu-world-clock-set__results" role="listbox">
          {results.length === 0 && <li className="fuyu-world-clock-set__hint">{text.noMatch}</li>}
          {results.map((item) => {
            const added = isAdded(item);
            return (
              <li key={`${item.kind}:${item.timeZone}:${item.en}`}>
                <button
                  type="button"
                  className="fuyu-world-clock-set__result"
                  disabled={added}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(item)}
                >
                  <span className="fuyu-world-clock-set__result-name">{text.isZh ? item.zh : item.en}</span>
                  <span className="fuyu-world-clock-set__zone">{added ? text.added : item.timeZone}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

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
