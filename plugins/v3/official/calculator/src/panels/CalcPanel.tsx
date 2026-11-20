import type { Context } from "@fuyu/plugin-base";
import { useRef, useState } from "react";
import { convertCurrency } from "../currency.ts";
import { tryEvaluate } from "../expr.ts";
import { formatAmount, formatNumber, formatPlain } from "../format.ts";
import { pushHistory } from "../model.ts";
import { currencyName, unitName } from "../names.ts";
import { parseQuery, type Query, type Target } from "../query.ts";
import { text } from "../text.ts";
import { Note, ResultRow } from "../ui.tsx";
import { convertUnit } from "../units.ts";
import { useRates, type PrefsApi } from "../usePrefs.ts";
import { Keypad } from "./Keypad.tsx";

function targetLabel(target: Target): string {
  return target.kind === "currency" ? target.code : unitName(target.category, target.id);
}

function convert(query: Query, rates: Record<string, number>): number | null {
  if (query.from.kind === "currency" && query.to.kind === "currency") return convertCurrency(rates, query.value, query.from.code, query.to.code);
  if (query.from.kind === "unit" && query.to.kind === "unit") return convertUnit(query.from.category, query.value, query.from.id, query.to.id);
  return null;
}

export function CalcPanel({ api, ctx }: { api: PrefsApi; ctx: Context }) {
  const input = useRef<HTMLInputElement | null>(null);
  const [cursor, setCursor] = useState(-1);
  const expr = api.field("calc.expr");
  const digits = api.prefs.settings.digits;
  const ansText = api.field("calc.ans");
  const vars: Record<string, number> = ansText && Number.isFinite(Number(ansText)) ? { ans: Number(ansText) } : {};
  const query = expr.trim() ? parseQuery(expr, vars) : null;
  const { rates } = useRates(ctx, query?.from.kind === "currency");
  const converted = query ? convert(query, rates.rates) : null;
  const value = !query && expr.trim() ? tryEvaluate(expr, vars) : null;
  const history = api.prefs.history;

  const setExpr = (next: string, caret = next.length) => {
    api.setField("calc.expr", next);
    setCursor(-1);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(caret, caret);
    });
  };

  const commit = () => {
    if (query && converted !== null) {
      const shown = query.to.kind === "currency" ? `${formatAmount(converted)} ${query.to.code}` : `${formatPlain(converted, digits)} ${targetLabel(query.to)}`;
      api.update({ history: pushHistory(history, `${expr.trim()} = ${shown}`) });
      return;
    }
    if (value === null || !Number.isFinite(value)) return;
    const plain = formatPlain(value, digits);
    if (plain === expr.trim()) return;
    api.update({ history: pushHistory(history, `${expr.trim()} = ${plain}`), fields: { "calc.expr": plain, "calc.ans": plain } });
    setCursor(-1);
  };

  const insert = (piece: string) => {
    const el = input.current;
    const start = el?.selectionStart ?? expr.length;
    const end = el?.selectionEnd ?? expr.length;
    setExpr(expr.slice(0, start) + piece + expr.slice(end), start + piece.length);
  };

  const action = (kind: "clear" | "back" | "equals" | "negate") => {
    if (kind === "clear") setExpr("");
    else if (kind === "equals") commit();
    else if (kind === "negate") setExpr(expr.trim() ? `-(${expr.trim()})` : "-");
    else {
      const el = input.current;
      const start = el?.selectionStart ?? expr.length;
      const end = el?.selectionEnd ?? expr.length;
      if (start !== end) setExpr(expr.slice(0, start) + expr.slice(end), start);
      else if (start > 0) setExpr(expr.slice(0, start - 1) + expr.slice(start), start - 1);
    }
  };

  const browse = (step: number) => {
    if (history.length === 0) return;
    const next = Math.max(-1, Math.min(history.length - 1, cursor + step));
    setCursor(next);
    api.setField("calc.expr", next < 0 ? "" : history[next].split(" = ")[0]);
  };

  let answer = null;
  if (query && converted !== null) {
    const amount = query.to.kind === "currency" ? formatAmount(converted) : formatNumber(converted, digits);
    const copy = query.to.kind === "currency" ? formatAmount(converted).replace(/,/g, "") : formatPlain(converted, digits);
    const sub = query.to.kind === "currency" ? currencyName(query.to.code) : undefined;
    answer = <ResultRow label={`${formatNumber(query.value, digits)} ${targetLabel(query.from)} =`} value={`${amount} ${targetLabel(query.to)}`} copyValue={copy} sub={sub} strong />;
  } else if (query) {
    answer = <span className="fuyu-calc__muted">{rates.loading ? text.currency.loading : text.currency.never}</span>;
  } else if (expr.trim()) {
    answer = value === null ? <span className="fuyu-calc__muted">{text.calc.error}</span> : <ResultRow label="=" value={formatNumber(value, digits)} copyValue={formatPlain(value, digits)} strong />;
  }

  return (
    <div className={api.prefs.settings.keypad ? "fuyu-calc__calc has-keypad" : "fuyu-calc__calc"}>
      <div className="fuyu-calc__panel">
        <input
          ref={input}
          className="fuyu-calc__input is-expr"
          value={expr}
          placeholder={text.calc.placeholder}
          spellCheck={false}
          autoFocus
          aria-label={text.tabs.calc}
          onChange={(event) => {
            setCursor(-1);
            api.setField("calc.expr", event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            else if (event.key === "Escape" && expr) {
              event.stopPropagation();
              setExpr("");
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              browse(1);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              browse(-1);
            }
          }}
        />
        <div className="fuyu-calc__answer" aria-live="polite">
          {answer}
        </div>
        {history.length > 0 && (
          <div className="fuyu-calc__history">
            <div className="fuyu-calc__history-head">
              <span>{text.calc.history}</span>
              <button type="button" className="fuyu-calc__link" onClick={() => api.update({ history: [] })}>
                {text.calc.clear}
              </button>
            </div>
            {history.map((entry) => (
              <button key={entry} type="button" className="fuyu-calc__history-item" title={entry} onClick={() => setExpr(entry.split(" = ")[0])}>
                {entry}
              </button>
            ))}
          </div>
        )}
        <Note>{text.calc.hint}</Note>
      </div>
      {api.prefs.settings.keypad && <Keypad onInsert={insert} onAction={action} />}
    </div>
  );
}
