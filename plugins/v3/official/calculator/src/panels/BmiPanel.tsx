import { bmiLevel, bmiLimits, bmiOf, healthyRange, type BmiStandard } from "../bmi.ts";
import { clamp, formatNumber, parseNumber } from "../format.ts";
import { text } from "../text.ts";
import { Field, Segmented } from "../ui.tsx";
import type { PrefsApi } from "../usePrefs.ts";

const SCALE_MIN = 14;
const SCALE_MAX = 36;
const percent = (value: number) => `${((clamp(value, SCALE_MIN, SCALE_MAX) - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100}%`;

export function BmiPanel({ api }: { api: PrefsApi }) {
  const heightText = api.field("bmi.height", "170");
  const weightText = api.field("bmi.weight", "65");
  const standard: BmiStandard = api.field("bmi.standard", "cn") === "who" ? "who" : "cn";
  const height = parseNumber(heightText);
  const weight = parseNumber(weightText);
  const bmi = height !== null && weight !== null ? bmiOf(height, weight) : null;
  const level = bmi === null ? null : bmiLevel(bmi, standard);
  const [under, over, obese] = bmiLimits(standard);
  const range = height !== null && height > 0 ? healthyRange(height, standard) : null;
  return (
    <div className="fuyu-calc__panel">
      <div className="fuyu-calc__split">
        <div className="fuyu-calc__column">
          <Field label={text.bmi.height} value={heightText} onChange={(next) => api.setField("bmi.height", next)} />
          <Field label={text.bmi.weight} value={weightText} onChange={(next) => api.setField("bmi.weight", next)} />
          <Segmented<BmiStandard>
            value={standard}
            options={[
              { value: "cn", label: text.bmi.standard.cn },
              { value: "who", label: text.bmi.standard.who },
            ]}
            onChange={(next) => api.setField("bmi.standard", next)}
          />
        </div>
        <div className="fuyu-calc__column">
          {bmi === null || level === null ? (
            <p className="fuyu-calc__muted">{text.invalid}</p>
          ) : (
            <>
              <div className="fuyu-calc__bmi">
                <span className="fuyu-calc__bmi-value">{formatNumber(bmi, 3)}</span>
                <span className={`fuyu-calc__badge is-${level}`}>{text.bmi.level[level]}</span>
              </div>
              <div className="fuyu-calc__scale" aria-hidden="true">
                <span className="is-under" style={{ width: percent(under) }} />
                <span className="is-normal" style={{ width: `calc(${percent(over)} - ${percent(under)})` }} />
                <span className="is-over" style={{ width: `calc(${percent(obese)} - ${percent(over)})` }} />
                <span className="is-obese" />
                <i style={{ left: percent(bmi) }} />
              </div>
              <div className="fuyu-calc__scale-labels">
                {[under, over, obese].map((limit) => (
                  <span key={limit} style={{ left: percent(limit) }}>
                    {limit}
                  </span>
                ))}
              </div>
              {range && <p className="fuyu-calc__muted">{text.bmi.healthy(formatNumber(range[0], 3), formatNumber(range[1], 3))}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
