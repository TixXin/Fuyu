import { COMMON_BASES, formatInBase, groupDigits, parseInBase } from "../radix.ts";
import { text } from "../text.ts";
import { Field, ResultRow, Select } from "../ui.tsx";
import type { PrefsApi } from "../usePrefs.ts";

const ALL_BASES = Array.from({ length: 35 }, (_, index) => index + 2);

export function RadixPanel({ api }: { api: PrefsApi }) {
  const raw = api.field("radix.value", "255");
  const base = Number(api.field("radix.base", "10")) || 10;
  const custom = Number(api.field("radix.custom", "36")) || 36;
  const value = parseInBase(raw, base);
  const baseLabel = (n: number) => text.radix.names[n] ?? text.radix.baseN(n);
  const options = ALL_BASES.map((n) => ({ value: String(n), label: baseLabel(n) }));
  const targets = [...COMMON_BASES, ...((COMMON_BASES as readonly number[]).includes(custom) ? [] : [custom])];
  return (
    <div className="fuyu-calc__panel">
      <div className="fuyu-calc__inputs">
        <Field label={text.value} value={raw} onChange={(next) => api.setField("radix.value", next)} wide />
        <Select label={text.radix.base} value={String(base)} options={options} onChange={(next) => api.setField("radix.base", next)} />
        <Select label={text.radix.custom} value={String(custom)} options={options} onChange={(next) => api.setField("radix.custom", next)} />
      </div>
      {value === null ? (
        <p className="fuyu-calc__muted">{text.invalid}</p>
      ) : (
        <div className="fuyu-calc__list">
          {targets.map((target) => {
            const plain = formatInBase(value, target);
            return <ResultRow key={target} label={baseLabel(target)} value={groupDigits(plain, target)} copyValue={plain} />;
          })}
        </div>
      )}
    </div>
  );
}
