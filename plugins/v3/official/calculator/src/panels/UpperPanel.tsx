import { toChineseDigits, toChineseLower, toChineseUpper, toRmbUpper } from "../chinese.ts";
import { formatPlain, isPlainNumber, parseValue } from "../format.ts";
import { text } from "../text.ts";
import { Field, Note, ResultRow } from "../ui.tsx";
import type { PrefsApi } from "../usePrefs.ts";

export function UpperPanel({ api }: { api: PrefsApi }) {
  const raw = api.field("upper.value", "12345.67");
  const computed = raw.trim() && !isPlainNumber(raw) ? parseValue(raw) : null;
  const source = computed === null ? raw : formatPlain(computed, 15);
  const rows = [
    { label: text.upper.rmb, value: toRmbUpper(source), strong: true },
    { label: text.upper.upperNum, value: toChineseUpper(source) },
    { label: text.upper.lowerNum, value: toChineseLower(source) },
    { label: text.upper.digits, value: toChineseDigits(source) },
  ];
  const valid = rows.every((row) => row.value !== null);
  return (
    <div className="fuyu-calc__panel">
      <Field label={text.value} value={raw} onChange={(next) => api.setField("upper.value", next)} wide />
      {valid ? (
        <div className="fuyu-calc__list">
          {rows.map((row) => (
            <ResultRow key={row.label} label={row.label} value={row.value ?? ""} strong={row.strong} />
          ))}
        </div>
      ) : (
        <p className="fuyu-calc__muted">{text.invalid}</p>
      )}
      <Note>{text.upper.hint}</Note>
    </div>
  );
}
