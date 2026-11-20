import { formatNumber, formatPlain, parseNumber } from "../format.ts";
import { unitName } from "../names.ts";
import { text } from "../text.ts";
import { Field, ResultRow, Select } from "../ui.tsx";
import { UNITS, convertAll, type UnitCategory } from "../units.ts";
import type { PrefsApi } from "../usePrefs.ts";

export function UnitPanel({ api, category }: { api: PrefsApi; category: UnitCategory }) {
  const raw = api.field(`${category}.value`, "1");
  const from = api.prefs.units[category];
  const value = parseNumber(raw);
  const digits = api.prefs.settings.digits;
  const options = UNITS[category].map((unit) => ({ value: unit.id, label: unitName(category, unit.id) }));
  return (
    <div className="fuyu-calc__panel">
      <div className="fuyu-calc__inputs">
        <Field label={text.value} value={raw} onChange={(next) => api.setField(`${category}.value`, next)} wide />
        <Select label={text.unit} value={from} options={options} onChange={(next) => api.update({ units: { ...api.prefs.units, [category]: next } })} />
      </div>
      {value === null ? (
        <p className="fuyu-calc__muted">{text.invalid}</p>
      ) : (
        <div className="fuyu-calc__grid">
          {convertAll(category, value, from).map((item) => (
            <ResultRow key={item.id} label={unitName(category, item.id)} value={formatNumber(item.value, digits)} copyValue={formatPlain(item.value, digits)} />
          ))}
        </div>
      )}
    </div>
  );
}
