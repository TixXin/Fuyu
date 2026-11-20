import { addDays, addMonths, addWorkdays, dateSpan, formatDate, parseDate, todayText, weekdayOf } from "../dates.ts";
import { formatNumber, parseNumber } from "../format.ts";
import { text } from "../text.ts";
import { Field, Note, ResultRow, Segmented, Select } from "../ui.tsx";
import type { PrefsApi } from "../usePrefs.ts";

type Mode = "span" | "add";
type Step = "days" | "workdays" | "months";

function SpanView({ api }: { api: PrefsApi }) {
  const today = todayText();
  const from = api.field("date.from", today);
  const to = api.field("date.to", today);
  const a = parseDate(from);
  const b = parseDate(to);
  const span = a !== null && b !== null ? dateSpan(a, b) : null;
  return (
    <div className="fuyu-calc__split">
      <div className="fuyu-calc__column">
        <Field label={text.date.from} type="date" value={from} onChange={(next) => api.setField("date.from", next)} />
        <Field label={text.date.to} type="date" value={to} onChange={(next) => api.setField("date.to", next)} />
      </div>
      <div className="fuyu-calc__column">
        {span ? (
          <>
            <ResultRow label={text.date.totalDays} value={formatNumber(span.days)} copyValue={String(span.days)} strong />
            <ResultRow label="" value={text.date.weeks(span.weeks, span.restDays)} />
            <ResultRow label="" value={text.date.ymd(span.years, span.months, span.monthDays)} />
            <ResultRow label={text.date.workdayCount} value={formatNumber(span.workdays)} copyValue={String(span.workdays)} />
          </>
        ) : (
          <p className="fuyu-calc__muted">{text.invalid}</p>
        )}
      </div>
    </div>
  );
}

function AddView({ api }: { api: PrefsApi }) {
  const base = api.field("date.base", todayText());
  const amountText = api.field("date.amount", "100");
  const step = api.field("date.step", "days") as Step;
  const at = parseDate(base);
  const amount = parseNumber(amountText);
  let result: number | null = null;
  if (at !== null && amount !== null && Math.abs(amount) <= 1_000_000) {
    result = step === "workdays" ? addWorkdays(at, amount) : step === "months" ? addMonths(at, Math.trunc(amount)) : addDays(at, amount);
  }
  const steps = [
    { value: "days", label: text.date.days },
    { value: "workdays", label: text.date.workdays },
    { value: "months", label: text.date.months },
  ];
  return (
    <div className="fuyu-calc__split">
      <div className="fuyu-calc__column">
        <Field label={text.date.base} type="date" value={base} onChange={(next) => api.setField("date.base", next)} />
        <div className="fuyu-calc__inputs">
          <Field label={text.date.amount} value={amountText} onChange={(next) => api.setField("date.amount", next)} wide />
          <Select label={text.unit} value={step} options={steps} onChange={(next) => api.setField("date.step", next)} />
        </div>
      </div>
      <div className="fuyu-calc__column">
        {result === null ? (
          <p className="fuyu-calc__muted">{text.invalid}</p>
        ) : (
          <ResultRow label={text.date.result} value={formatDate(result)} sub={text.date.weekday[weekdayOf(result)]} strong />
        )}
      </div>
    </div>
  );
}

export function DatePanel({ api }: { api: PrefsApi }) {
  const mode = (api.field("date.mode", "span") === "add" ? "add" : "span") as Mode;
  return (
    <div className="fuyu-calc__panel">
      <Segmented<Mode>
        value={mode}
        options={[
          { value: "span", label: text.date.span },
          { value: "add", label: text.date.add },
        ]}
        onChange={(next) => api.setField("date.mode", next)}
      />
      {mode === "span" ? <SpanView api={api} /> : <AddView api={api} />}
      <Note>{text.date.note}</Note>
    </div>
  );
}
