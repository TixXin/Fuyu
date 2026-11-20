import type { Context } from "@fuyu/plugin-base";
import { useEffect, useState, type ReactNode } from "react";
import { DIGIT_CHOICES, RATE_HOUR_CHOICES, TABS, type Tab } from "./model.ts";
import { text } from "./text.ts";
import { usePrefs } from "./usePrefs.ts";
import "./settings.css";

const S = text.set;

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="fuyu-calc-set__group">
      <h3 className="fuyu-calc-set__title">{title}</h3>
      {hint && <p className="fuyu-calc-set__hint">{hint}</p>}
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="fuyu-calc-set__row">
      <span>{label}</span>
      {children}
    </label>
  );
}

function RateField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = (raw: string) => {
    const number = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(number)) return setDraft(String(value));
    const next = Math.min(50, Math.max(0, Math.round(number * 10) / 10));
    setDraft(String(next));
    if (next !== value) onChange(next);
  };
  return (
    <span className="fuyu-calc-set__number">
      <input type="number" min={0} max={50} step={0.5} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={(event) => commit(event.target.value)} onKeyDown={(event) => event.key === "Enter" && commit(event.currentTarget.value)} />
      <span>%</span>
    </span>
  );
}

export default function apply(ctx: Context) {
  function CalculatorSection() {
    const { prefs, setSettings } = usePrefs(ctx);
    const { settings } = prefs;
    const toggle = (tab: Tab, shown: boolean) => {
      const hidden = shown ? settings.hidden.filter((item) => item !== tab) : [...settings.hidden, tab];
      if (hidden.length < TABS.length) setSettings({ hidden });
    };
    return (
      <section className="fuyu-calc-set">
        <Group title={S.tabsTitle} hint={S.tabsHint}>
          <div className="fuyu-calc-set__tabs">
            {TABS.map((tab) => {
              const shown = !settings.hidden.includes(tab);
              const last = shown && settings.hidden.length === TABS.length - 1;
              return (
                <label key={tab} className="fuyu-calc-set__check">
                  <input type="checkbox" checked={shown} disabled={last} onChange={(event) => toggle(tab, event.target.checked)} />
                  <span>{text.tabs[tab]}</span>
                </label>
              );
            })}
          </div>
        </Group>
        <Group title={S.openTitle}>
          <Row label={S.openOn}>
            <select value={settings.openOn} onChange={(event) => setSettings({ openOn: event.target.value as Tab | "last" })}>
              <option value="last">{S.openLast}</option>
              {TABS.filter((tab) => !settings.hidden.includes(tab)).map((tab) => (
                <option key={tab} value={tab}>
                  {text.tabs[tab]}
                </option>
              ))}
            </select>
          </Row>
        </Group>
        <Group title={S.resultTitle}>
          <Row label={S.digits}>
            <select value={settings.digits} onChange={(event) => setSettings({ digits: Number(event.target.value) })}>
              {DIGIT_CHOICES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Row>
        </Group>
        <Group title={S.ratesTitle} hint={text.currency.source}>
          <Row label={S.ratesHours}>
            <select value={settings.ratesHours} onChange={(event) => setSettings({ ratesHours: Number(event.target.value) })}>
              {RATE_HOUR_CHOICES.map((n) => (
                <option key={n} value={n}>
                  {S.hours(n)}
                </option>
              ))}
            </select>
          </Row>
        </Group>
        <Group title={S.taxTitle} hint={S.insuranceHint}>
          <Row label={S.insuranceRate}>
            <RateField value={settings.insuranceRate} onChange={(insuranceRate) => setSettings({ insuranceRate })} />
          </Row>
        </Group>
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", { id: "calculator", category: "pluginsV3", component: CalculatorSection });
}
