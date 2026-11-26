import { useState } from "react";
import { ArrowIcon, CloseIcon } from "./icons.tsx";
import { MAX_STOCKS, METHODS, displayCode, type AddResult, type StockItem } from "./model.ts";
import { text } from "./text.ts";

type Invoke = (method: string, params?: unknown) => void;

function Who({ stock }: { stock: StockItem }) {
  const meta = [displayCode(stock), stock.kind].filter(Boolean).join(" · ");
  return (
    <span className="fuyu-stock-set__who" title={`${stock.name} ${meta}`}>
      <span className="fuyu-stock-set__name">{stock.name}</span>
      <span className="fuyu-stock-set__meta">{meta}</span>
    </span>
  );
}

export function StockList({
  stocks,
  invoke,
  search,
  addStock,
}: {
  stocks: readonly StockItem[];
  invoke: Invoke;
  search: (keyword: string) => Promise<StockItem[]>;
  addStock: (stock: StockItem) => Promise<AddResult>;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<StockItem[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const full = stocks.length >= MAX_STOCKS;
  const owned = new Set(stocks.map((stock) => stock.id));

  async function submit() {
    const value = draft.trim();
    if (!value || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const found = await search(value);
      setResults(found);
      if (found.length === 0) setProblem(text.noResults);
    } catch {
      setResults(null);
      setProblem(text.searchFailed);
    } finally {
      setBusy(false);
    }
  }

  async function add(stock: StockItem) {
    setProblem(null);
    try {
      const result = await addStock(stock);
      if (!result.ok) setProblem(text.addErrors[result.reason]);
    } catch {
      setProblem(text.addErrors.invalid);
    }
  }

  return (
    <>
      <form
        className="fuyu-stock-set__add"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          className="fuyu-stock-set__input"
          type="search"
          value={draft}
          placeholder={text.searchPlaceholder}
          aria-label={text.watchlistTitle}
          spellCheck={false}
          autoCapitalize="off"
          onChange={(event) => {
            setDraft(event.target.value);
            setProblem(null);
            if (event.target.value.trim() === "") setResults(null);
          }}
        />
        <button type="submit" className="fuyu-stock-set__button is-primary" disabled={busy || draft.trim() === ""}>
          {busy ? text.searching : text.search}
        </button>
      </form>
      {(problem || full) && <p className="fuyu-stock-set__hint is-warn">{problem ?? text.addErrors.full}</p>}
      {results && results.length > 0 && (
        <ul className="fuyu-stock-set__results">
          {results.map((stock) => (
            <li key={stock.id} className="fuyu-stock-set__result">
              <Who stock={stock} />
              <button
                type="button"
                className="fuyu-stock-set__button"
                disabled={owned.has(stock.id) || full}
                onClick={() => void add(stock)}
              >
                {owned.has(stock.id) ? text.added : text.add}
              </button>
            </li>
          ))}
        </ul>
      )}
      {stocks.length > 0 && (
        <ul className="fuyu-stock-set__stocks">
          {stocks.map((stock, index) => (
            <li key={stock.id} className="fuyu-stock-set__stock">
              <Who stock={stock} />
              <span className="fuyu-stock-set__tools">
                <button
                  type="button"
                  className="fuyu-stock-set__icon"
                  title={text.moveUp}
                  aria-label={`${text.moveUp} ${stock.name}`}
                  disabled={index === 0}
                  onClick={() => invoke(METHODS.moveStock, { from: index, to: index - 1 })}
                >
                  <ArrowIcon direction="up" />
                </button>
                <button
                  type="button"
                  className="fuyu-stock-set__icon"
                  title={text.moveDown}
                  aria-label={`${text.moveDown} ${stock.name}`}
                  disabled={index === stocks.length - 1}
                  onClick={() => invoke(METHODS.moveStock, { from: index, to: index + 1 })}
                >
                  <ArrowIcon direction="down" />
                </button>
                <button
                  type="button"
                  className="fuyu-stock-set__icon"
                  title={text.remove}
                  aria-label={`${text.remove} ${stock.name}`}
                  onClick={() => invoke(METHODS.removeStock, { id: stock.id })}
                >
                  <CloseIcon />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
