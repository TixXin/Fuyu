import { formatMoney, parseNumber } from "../format.ts";
import { DEFAULT_COMMERCIAL_RATE, DEFAULT_FUND_RATE, combinedLoan, type LoanPart, type LoanResult } from "../loan.ts";
import { text } from "../text.ts";
import { Field, ResultRow, Segmented } from "../ui.tsx";
import type { PrefsApi } from "../usePrefs.ts";

type Kind = "commercial" | "fund" | "combo";

const money = (value: number) => `¥${formatMoney(value)}`;

function Column({ title, result, principal }: { title: string; result: LoanResult; principal: boolean }) {
  return (
    <div className="fuyu-calc__column">
      <span className="fuyu-calc__column-title">{title}</span>
      <ResultRow label={principal ? text.loan.first : text.loan.monthly} value={money(result.firstPayment)} copyValue={formatMoney(result.firstPayment)} strong sub={principal ? text.loan.drop(formatMoney(result.monthlyDrop)) : undefined} />
      <ResultRow label={text.loan.interest} value={money(result.totalInterest)} copyValue={formatMoney(result.totalInterest)} />
      <ResultRow label={text.loan.total} value={money(result.totalPayment)} copyValue={formatMoney(result.totalPayment)} />
    </div>
  );
}

export function LoanPanel({ api }: { api: PrefsApi }) {
  const kind = (api.field("loan.kind", "commercial") as Kind) || "commercial";
  const commercialText = api.field("loan.commercial", "100");
  const fundText = api.field("loan.fund", "60");
  const commercialRateText = api.field("loan.commercialRate", String(DEFAULT_COMMERCIAL_RATE));
  const fundRateText = api.field("loan.fundRate", String(DEFAULT_FUND_RATE));
  const yearsText = api.field("loan.years", "30");
  const parts: (LoanPart | null)[] = [];
  const toPart = (amountText: string, rateText: string): LoanPart | null => {
    const amount = parseNumber(amountText);
    const rate = parseNumber(rateText);
    return amount !== null && rate !== null && amount >= 0 && rate >= 0 ? { amount: amount * 10_000, rate } : null;
  };
  if (kind !== "fund") parts.push(toPart(commercialText, commercialRateText));
  if (kind !== "commercial") parts.push(toPart(fundText, fundRateText));
  const years = parseNumber(yearsText);
  const valid = parts.every(Boolean) && years !== null && years > 0 && years <= 50;
  const clean = parts.filter((part): part is LoanPart => part !== null);
  return (
    <div className="fuyu-calc__panel">
      <Segmented<Kind>
        value={kind}
        options={(["commercial", "fund", "combo"] as Kind[]).map((value) => ({ value, label: text.loan.kind[value] }))}
        onChange={(next) => api.setField("loan.kind", next)}
      />
      <div className="fuyu-calc__split">
        <div className="fuyu-calc__column">
          {kind !== "fund" && (
            <div className="fuyu-calc__inputs">
              <Field label={text.loan.commercialAmount} value={commercialText} onChange={(next) => api.setField("loan.commercial", next)} wide />
              <Field label={text.loan.commercialRate} value={commercialRateText} onChange={(next) => api.setField("loan.commercialRate", next)} narrow />
            </div>
          )}
          {kind !== "commercial" && (
            <div className="fuyu-calc__inputs">
              <Field label={text.loan.fundAmount} value={fundText} onChange={(next) => api.setField("loan.fund", next)} wide />
              <Field label={text.loan.fundRate} value={fundRateText} onChange={(next) => api.setField("loan.fundRate", next)} narrow />
            </div>
          )}
          <Field label={text.loan.years} value={yearsText} onChange={(next) => api.setField("loan.years", next)} />
        </div>
        {valid && years !== null ? (
          <>
            <Column title={text.loan.annuity} result={combinedLoan(clean, years, "annuity")} principal={false} />
            <Column title={text.loan.principal} result={combinedLoan(clean, years, "principal")} principal />
          </>
        ) : (
          <p className="fuyu-calc__muted">{text.invalid}</p>
        )}
      </div>
    </div>
  );
}
