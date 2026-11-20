import { tryEvaluate } from "../expr.ts";
import { formatNumber, formatPlain } from "../format.ts";
import { pushHistory } from "../model.ts";
import { text } from "../text.ts";
import { Note, ResultRow } from "../ui.tsx";
import type { PrefsApi } from "../usePrefs.ts";

export function CalcPanel({ api }: { api: PrefsApi }) {
  const expr = api.field("calc.expr");
  const value = expr.trim() ? tryEvaluate(expr) : null;
  const digits = api.prefs.settings.digits;
  const commit = () => {
    if (value === null) return;
    api.update({ history: pushHistory(api.prefs.history, `${expr.trim()} = ${formatPlain(value, digits)}`) });
  };
  return (
    <div className="fuyu-calc__panel">
      <input
        className="fuyu-calc__input is-expr"
        value={expr}
        placeholder={text.calc.placeholder}
        spellCheck={false}
        autoFocus
        onChange={(event) => api.setField("calc.expr", event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") api.setField("calc.expr", "");
        }}
      />
      <div className="fuyu-calc__answer" aria-live="polite">
        {expr.trim() ? (value === null ? <span className="fuyu-calc__muted">{text.calc.error}</span> : <ResultRow label="=" value={formatNumber(value, digits)} copyValue={formatPlain(value, digits)} strong />) : null}
      </div>
      {api.prefs.history.length > 0 && (
        <div className="fuyu-calc__history">
          <div className="fuyu-calc__history-head">
            <span>{text.calc.history}</span>
            <button type="button" className="fuyu-calc__link" onClick={() => api.update({ history: [] })}>
              {text.calc.clear}
            </button>
          </div>
          {api.prefs.history.map((entry) => (
            <button key={entry} type="button" className="fuyu-calc__history-item" onClick={() => api.setField("calc.expr", entry.split(" = ")[0])}>
              {entry}
            </button>
          ))}
        </div>
      )}
      <Note>{text.calc.hint}</Note>
    </div>
  );
}
