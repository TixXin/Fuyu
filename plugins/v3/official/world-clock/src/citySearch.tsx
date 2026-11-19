import { useMemo, useState } from "react";
import { searchCities, type SearchResult } from "./cities.ts";
import { MAX_CITIES, METHODS, type WorldCity } from "./model.ts";
import { text } from "./text.ts";
import "./search.css";

type Invoke = (method: string, params?: unknown) => void;

type Props = {
  cities: readonly WorldCity[];
  invoke: Invoke;
  inline?: boolean;
  autoFocus?: boolean;
  onClose?: () => void;
};

export function CitySearch({ cities, invoke, inline = false, autoFocus = false, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(autoFocus);
  const results = useMemo(() => (open ? searchCities(query, inline ? 8 : 30) : []), [open, query, inline]);
  const full = cities.length >= MAX_CITIES;
  const isAdded = (item: SearchResult) =>
    cities.some((city) => city.timeZone === item.timeZone && city.labelEn === item.en);

  function close() {
    setOpen(false);
    onClose?.();
  }

  function add(item: SearchResult) {
    if (full || isAdded(item)) return;
    invoke(METHODS.add, { timeZone: item.timeZone, labelZh: item.zh, labelEn: item.en, shortCode: item.code });
    setQuery("");
    close();
  }

  const className = inline ? "fuyu-world-clock-search fuyu-world-clock-search--inline" : "fuyu-world-clock-search";
  return (
    <div className={className}>
      <input
        type="search"
        className="fuyu-world-clock-search__input"
        placeholder={text.searchPlaceholder}
        value={query}
        disabled={full}
        autoFocus={autoFocus}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(close, 150)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) add(results[0]);
          if (e.key === "Escape") close();
        }}
      />
      {full && <p className="fuyu-world-clock-search__hint">{text.full(MAX_CITIES)}</p>}
      {open && !full && (
        <ul className="fuyu-world-clock-search__results" role="listbox">
          {results.length === 0 && <li className="fuyu-world-clock-search__hint">{text.noMatch}</li>}
          {results.map((item) => {
            const added = isAdded(item);
            return (
              <li key={`${item.kind}:${item.timeZone}:${item.en}`}>
                <button
                  type="button"
                  className="fuyu-world-clock-search__result"
                  disabled={added}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(item)}
                >
                  <span className="fuyu-world-clock-search__name">{text.isZh ? item.zh : item.en}</span>
                  <span className="fuyu-world-clock-search__zone">{added ? text.added : item.timeZone}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
