import { addDays, addMonths, addWorkdays, dateSpan, formatDate, parseDate, todayText, weekdayOf } from "../dates.ts";
import { formatNumber, parseValue } from "../format.ts";
import { text } from "../text.ts";
import { ageOf, lunarOf } from "../age.ts";
import { Field, Note, ResultRow, Segmented, Select, TodayButton } from "../ui.tsx";
import type { PrefsApi } from "../usePrefs.ts";

type Mode = "span" | "add" | "age";
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
        <Field label={text.date.from} type="date" value={from} onChange={(next) => api.setField("date.from", next)} suffix={<TodayButton onClick={() => api.setField("date.from", today)} />} />
        <Field label={text.date.to} type="date" value={to} onChange={(next) => api.setField("date.to", next)} suffix={<TodayButton onClick={() => api.setField("date.to", today)} />} />
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
  const amount = parseValue(amountText);
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
        <Field label={text.date.base} type="date" value={base} onChange={(next) => api.setField("date.base", next)} suffix={<TodayButton onClick={() => api.setField("date.base", todayText())} />} />
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

function AgeView({ api }: { api: PrefsApi }) {
  const today = todayText();
  const birth = api.field("date.birth", "2000-01-01");
  const birthAt = parseDate(birth);
  const todayAt = parseDate(today);
  const age = birthAt !== null && todayAt !== null ? ageOf(birthAt, todayAt) : null;
  const lunar = birthAt !== null ? lunarOf(birthAt) : null;
  return (
    <div className="fuyu-calc__split">
      <div className="fuyu-calc__column">
        <Field label={text.date.birthday} type="date" value={birth} onChange={(next) => api.setField("date.birth", next)} />
        {lunar && <ResultRow label={text.date.lunar} value={`${lunar.yearName}年${lunar.month}${lunar.day}`} />}
      </div>
      <div className="fuyu-calc__column">
        {age === null ? (
          <p className="fuyu-calc__muted">{birthAt !== null && todayAt !== null && birthAt > todayAt ? text.date.future : text.invalid}</p>
        ) : (
          <>
            <ResultRow label={text.date.years} value={text.date.yearsValue(age.years)} copyValue={String(age.years)} strong />
            <ResultRow label={text.date.nominal} value={text.date.yearsValue(age.nominal)} copyValue={String(age.nominal)} />
            <ResultRow label={text.date.zodiac} value={text.date.zodiacNames[age.zodiac]} />
            <ResultRow label={text.date.sign} value={text.date.signNames[age.sign]} />
            <ResultRow label={text.date.lived} value={formatNumber(age.daysLived)} copyValue={String(age.daysLived)} />
            <ResultRow label={text.date.nextBirthday} value={formatDate(age.nextBirthday)} sub={`${text.date.weekday[weekdayOf(age.nextBirthday)]} · ${text.date.inDays(age.daysToBirthday)}`} />
          </>
        )}
      </div>
    </div>
  );
}

export function DatePanel({ api }: { api: PrefsApi }) {
  const stored = api.field("date.mode", "span");
  const mode: Mode = stored === "add" || stored === "age" ? stored : "span";
  return (
    <div className="fuyu-calc__panel">
      <Segmented<Mode>
        value={mode}
        options={[
          { value: "span", label: text.date.span },
          { value: "add", label: text.date.add },
          { value: "age", label: text.date.age },
        ]}
        onChange={(next) => api.setField("date.mode", next)}
      />
      {mode === "span" ? <SpanView api={api} /> : mode === "add" ? <AddView api={api} /> : <AgeView api={api} />}
      {mode !== "age" && <Note>{text.date.note}</Note>}
    </div>
  );
}
