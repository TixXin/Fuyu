import { formatMoney, parseNumber } from "../format.ts";
import { estimateInsurance, salaryTax } from "../tax.ts";
import { text } from "../text.ts";
import { Field, Note, ResultRow } from "../ui.tsx";
import type { PrefsApi } from "../usePrefs.ts";

const money = (value: number) => `¥${formatMoney(value)}`;

export function TaxPanel({ api }: { api: PrefsApi }) {
  const salaryText = api.field("tax.salary", "20000");
  const insuranceText = api.field("tax.insurance");
  const specialText = api.field("tax.special", "0");
  const bonusText = api.field("tax.bonus", "0");
  const salary = parseNumber(salaryText);
  const rate = api.prefs.settings.insuranceRate;
  const estimate = salary === null ? 0 : estimateInsurance(salary, rate);
  const insurance = insuranceText.trim() ? parseNumber(insuranceText) : estimate;
  const special = specialText.trim() ? parseNumber(specialText) : 0;
  const bonus = bonusText.trim() ? parseNumber(bonusText) : 0;
  const ready = salary !== null && insurance !== null && special !== null && bonus !== null;
  const result = ready ? salaryTax({ salary, insurance, special, bonus }) : null;
  return (
    <div className="fuyu-calc__panel">
      <div className="fuyu-calc__split">
        <div className="fuyu-calc__column">
          <Field label={text.tax.salary} value={salaryText} onChange={(next) => api.setField("tax.salary", next)} />
          <Field label={text.tax.insurance} value={insuranceText} placeholder={text.tax.insuranceHint(formatMoney(estimate), rate)} onChange={(next) => api.setField("tax.insurance", next)} />
          <Field label={text.tax.special} value={specialText} onChange={(next) => api.setField("tax.special", next)} />
          <Field label={text.tax.bonus} value={bonusText} onChange={(next) => api.setField("tax.bonus", next)} />
        </div>
        <div className="fuyu-calc__column">
          {result ? (
            <>
              <ResultRow label={text.tax.netMonth} value={money(result.averageNet)} copyValue={formatMoney(result.averageNet)} strong />
              <ResultRow label={text.tax.firstMonth} value={money(result.months[0].tax)} copyValue={formatMoney(result.months[0].tax)} />
              <ResultRow label={text.tax.lastMonth} value={money(result.months[11].tax)} copyValue={formatMoney(result.months[11].tax)} />
              <ResultRow label={text.tax.salaryTax} value={money(result.salaryTax)} copyValue={formatMoney(result.salaryTax)} />
              {bonus !== null && bonus > 0 && (
                <ResultRow
                  label={text.tax.bonusTax}
                  value={money(Math.min(result.bonusSeparateTax, result.bonusMergedTax))}
                  sub={result.bonusBest === "separate" ? text.tax.separate : text.tax.merged}
                />
              )}
              <ResultRow label={text.tax.total} value={money(result.totalTax)} copyValue={formatMoney(result.totalTax)} />
              <ResultRow label={text.tax.netYear} value={money(result.annualNet)} copyValue={formatMoney(result.annualNet)} />
            </>
          ) : (
            <p className="fuyu-calc__muted">{text.invalid}</p>
          )}
        </div>
      </div>
      {result && (
        <div className="fuyu-calc__months" aria-label={text.tax.months}>
          {result.months.map((row) => (
            <span key={row.month} className="fuyu-calc__month">
              <span className="fuyu-calc__month-n">{row.month}</span>
              <span>{formatMoney(row.tax)}</span>
            </span>
          ))}
        </div>
      )}
      <Note>{text.tax.note}</Note>
    </div>
  );
}
