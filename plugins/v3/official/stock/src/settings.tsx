import type { Context } from "@fuyu/plugin-base";
import type { ReactNode } from "react";
import {
  BAR_SECONDS_OPTIONS,
  LAYOUT_OPTIONS,
  METHODS,
  REFRESH_OPTIONS,
  type BarMode,
  type ColorScheme,
  type LayoutMode,
  type StockSettings,
} from "./model.ts";
import { StockList } from "./settingsStocks.tsx";
import { text } from "./text.ts";
import { useStocks } from "./useStocks.ts";
import "./settings.css";

type Patch = (patch: Partial<StockSettings>) => void;
type FlagKey = "showInBar" | "barPrice" | "refreshOnOpen";

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="fuyu-stock-set__group">
      <h3 className="fuyu-stock-set__title">{title}</h3>
      {hint && <p className="fuyu-stock-set__hint">{hint}</p>}
      {children}
    </div>
  );
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div className="fuyu-stock-set__row">
      <span className="fuyu-stock-set__label">{label}</span>
      <div className="fuyu-stock-set__seg" role="radiogroup" aria-label={label}>
        {options.map(([option, name]) => (
          <button
            key={String(option)}
            type="button"
            role="radio"
            aria-checked={option === value}
            disabled={disabled}
            className={option === value ? "fuyu-stock-set__seg-item is-on" : "fuyu-stock-set__seg-item"}
            onClick={() => onChange(option)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Flag({ name, label, settings, patch }: { name: FlagKey; label: string; settings: StockSettings; patch: Patch }) {
  return (
    <label className="fuyu-stock-set__check">
      <input type="checkbox" checked={settings[name]} onChange={(event) => patch({ [name]: event.target.checked })} />
      <span>{label}</span>
    </label>
  );
}

const SCHEMES: readonly (readonly [ColorScheme, string])[] = [
  ["redUp", text.redUp],
  ["greenUp", text.greenUp],
];

const LAYOUTS: readonly (readonly [LayoutMode, string])[] = LAYOUT_OPTIONS.map((mode) => [mode, text.layouts[mode]] as const);

const BAR_MODES: readonly (readonly [BarMode, string])[] = [
  ["rotate", text.barRotate],
  ["fixed", text.barFixed],
];

export default function apply(ctx: Context) {
  function StockSection() {
    const { state, error, invoke, search, addStock } = useStocks(ctx);
    const { settings } = state;
    const patch: Patch = (next) => invoke(METHODS.setSettings, next);
    return (
      <section className="fuyu-stock-set">
        <Group title={text.watchlistTitle} hint={text.watchlistHint}>
          <StockList stocks={settings.stocks} invoke={invoke} search={search} addStock={addStock} />
        </Group>
        <Group title={text.colorsTitle} hint={text.layoutHint}>
          <Segmented label={text.layoutLabel} value={settings.layout} options={LAYOUTS} onChange={(layout) => patch({ layout })} />
          <Segmented label={text.colorScheme} value={settings.colorScheme} options={SCHEMES} onChange={(colorScheme) => patch({ colorScheme })} />
        </Group>
        <Group title={text.refreshTitle} hint={text.refreshHint}>
          <Segmented
            label={text.refreshEvery}
            value={settings.refreshSeconds}
            options={REFRESH_OPTIONS.map((n) => [n, text.seconds(n)] as const)}
            onChange={(refreshSeconds) => patch({ refreshSeconds })}
          />
          <Flag name="refreshOnOpen" label={text.refreshOnOpen} settings={settings} patch={patch} />
        </Group>
        <Group title={text.barSection}>
          <Flag name="showInBar" label={text.showInBar} settings={settings} patch={patch} />
          <Segmented
            label={text.barMode}
            value={settings.barMode}
            options={BAR_MODES}
            disabled={!settings.showInBar}
            onChange={(barMode) => patch({ barMode })}
          />
          <Segmented
            label={text.barSeconds}
            value={settings.barSeconds}
            options={BAR_SECONDS_OPTIONS.map((n) => [n, text.seconds(n)] as const)}
            disabled={!settings.showInBar || settings.barMode !== "rotate"}
            onChange={(barSeconds) => patch({ barSeconds })}
          />
          <Flag name="barPrice" label={text.barPrice} settings={settings} patch={patch} />
        </Group>
        {error && <p className="fuyu-stock-set__hint is-warn">{error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", { id: "@fuyu/stock", category: "pluginsV3", component: StockSection });
}
