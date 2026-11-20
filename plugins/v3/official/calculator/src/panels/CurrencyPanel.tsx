import type { Context } from "@fuyu/plugin-base";
import { CURRENCIES, DEFAULT_FROM, convertCurrency } from "../currency.ts";
import { formatAmount, formatNumber, parseNumber } from "../format.ts";
import { currencyName } from "../names.ts";
import { locale, text } from "../text.ts";
import { Field, Note, ResultRow, Select } from "../ui.tsx";
import { useRates, type PrefsApi } from "../usePrefs.ts";

function timeText(at: number): string {
  return new Date(at).toLocaleString(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function CurrencyPanel({ api, ctx }: { api: PrefsApi; ctx: Context }) {
  const { rates, refresh } = useRates(ctx);
  const raw = api.field("currency.value", "100");
  const from = api.field("currency.from", DEFAULT_FROM);
  const value = parseNumber(raw);
  const options = CURRENCIES.map((code) => ({ value: code, label: `${code} ${currencyName(code)}` }));
  const status = rates.loading ? text.currency.loading : rates.updatedAt ? text.currency.updated(timeText(rates.updatedAt)) : rates.error ? text.currency.failed : text.currency.never;
  return (
    <div className="fuyu-calc__panel">
      <div className="fuyu-calc__inputs">
        <Field label={text.value} value={raw} onChange={(next) => api.setField("currency.value", next)} wide />
        <Select label={text.currency.from} value={from} options={options} onChange={(next) => api.setField("currency.from", next)} />
      </div>
      <div className="fuyu-calc__status">
        <span className={rates.error && !rates.loading ? "fuyu-calc__warn" : ""}>{rates.error && rates.updatedAt && !rates.loading ? `${text.currency.failed} · ${status}` : status}</span>
        <button type="button" className="fuyu-calc__link" disabled={rates.loading} onClick={refresh}>
          {text.currency.refresh}
        </button>
      </div>
      {value === null ? (
        <p className="fuyu-calc__muted">{text.invalid}</p>
      ) : (
        <div className="fuyu-calc__grid">
          {CURRENCIES.filter((code) => code !== from).map((code) => {
            const result = convertCurrency(rates.rates, value, from, code);
            const unit = convertCurrency(rates.rates, 1, from, code);
            return (
              <ResultRow
                key={code}
                label={`${code} ${currencyName(code)}`}
                value={result === null ? "—" : formatAmount(result)}
                copyValue={result === null ? "" : formatAmount(result).replace(/,/g, "")}
                sub={unit === null ? undefined : `1 ${from} = ${formatNumber(unit, 5)}`}
              />
            );
          })}
        </div>
      )}
      <Note>{text.currency.source}</Note>
    </div>
  );
}
