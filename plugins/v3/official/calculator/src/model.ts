import { UNIT_CATEGORIES, DEFAULT_UNIT, findUnit, type UnitCategory } from "./units.ts";

export const PLUGIN_NAME = "@fuyu/calculator";
export const PAGE_ID = "calculator";

export const METHODS = {
  prefs: "calculator.prefs",
  setSettings: "calculator.setSettings",
  setPrefs: "calculator.setPrefs",
  rates: "calculator.rates",
  refreshRates: "calculator.refreshRates",
} as const;

export const TOPICS = {
  settings: "calculator.settings",
  rates: "calculator.rates",
} as const;

export const TABS = [
  "calc",
  "currency",
  ...UNIT_CATEGORIES,
  "date",
  "radix",
  "upper",
  "tax",
  "loan",
  "kinship",
  "bmi",
] as const;

export type Tab = (typeof TABS)[number];

export const DIGIT_CHOICES = [6, 8, 10, 12] as const;
export const RATE_HOUR_CHOICES = [1, 3, 6, 12, 24] as const;

export interface CalculatorSettings {
  hidden: Tab[];
  openOn: "last" | Tab;
  digits: number;
  ratesHours: number;
  insuranceRate: number;
}

export const DEFAULT_SETTINGS: CalculatorSettings = { hidden: [], openOn: "last", digits: 10, ratesHours: 6, insuranceRate: 22.5 };

export interface Prefs {
  tab: Tab;
  settings: CalculatorSettings;
  units: Record<UnitCategory, string>;
  history: string[];
  fields: Record<string, string>;
}

export interface RatesSnapshot {
  base: string;
  rates: Record<string, number>;
  updatedAt: number | null;
  fetchedAt: number | null;
  loading: boolean;
  error: string | null;
}

export const EMPTY_RATES: RatesSnapshot = { base: "USD", rates: {}, updatedAt: null, fetchedAt: null, loading: false, error: null };

export const MAX_HISTORY = 8;
const MAX_FIELDS = 120;
const MAX_FIELD_LENGTH = 200;

export function isTab(value: unknown): value is Tab {
  return typeof value === "string" && (TABS as readonly string[]).includes(value);
}

export function defaultPrefs(): Prefs {
  return { tab: "calc", settings: { ...DEFAULT_SETTINGS, hidden: [] }, units: { ...DEFAULT_UNIT }, history: [], fields: {} };
}

function normalizeUnits(raw: unknown): Record<UnitCategory, string> {
  const units = { ...DEFAULT_UNIT };
  if (!raw || typeof raw !== "object") return units;
  for (const category of UNIT_CATEGORIES) {
    const value = (raw as Record<string, unknown>)[category];
    if (typeof value === "string" && findUnit(category, value)) units[category] = value;
  }
  return units;
}

function normalizeHistory(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.slice(0, MAX_FIELD_LENGTH)).slice(0, MAX_HISTORY);
}

function normalizeFields(raw: unknown): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return fields;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>).slice(0, MAX_FIELDS)) {
    if (typeof value === "string" && key.length <= 40) fields[key] = value.slice(0, MAX_FIELD_LENGTH);
  }
  return fields;
}

function pick<T extends number>(value: unknown, choices: readonly T[], fallback: T): T {
  return choices.includes(value as T) ? (value as T) : fallback;
}

export function normalizeSettings(raw: unknown): CalculatorSettings {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const hidden = Array.isArray(source.hidden) ? [...new Set(source.hidden.filter(isTab))] : [];
  const rate = typeof source.insuranceRate === "number" && Number.isFinite(source.insuranceRate) ? Math.min(50, Math.max(0, Math.round(source.insuranceRate * 10) / 10)) : DEFAULT_SETTINGS.insuranceRate;
  return {
    hidden: hidden.length >= TABS.length ? [] : hidden,
    openOn: isTab(source.openOn) ? source.openOn : "last",
    digits: pick(source.digits, DIGIT_CHOICES, 10),
    ratesHours: pick(source.ratesHours, RATE_HOUR_CHOICES, 6),
    insuranceRate: rate,
  };
}

export function visibleTabs(settings: CalculatorSettings): Tab[] {
  return TABS.filter((tab) => !settings.hidden.includes(tab));
}

export function shownTab(tab: Tab, settings: CalculatorSettings): Tab {
  const visible = visibleTabs(settings);
  return visible.includes(tab) ? tab : (visible[0] ?? "calc");
}

export function openingTab(prefs: Prefs): Tab {
  const { openOn } = prefs.settings;
  return shownTab(openOn === "last" ? prefs.tab : openOn, prefs.settings);
}

export function normalizePrefs(raw: unknown): Prefs {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    tab: isTab(source.tab) ? source.tab : "calc",
    settings: normalizeSettings(source.settings),
    units: normalizeUnits(source.units),
    history: normalizeHistory(source.history),
    fields: normalizeFields(source.fields),
  };
}

export function mergePrefs(current: Prefs, patch: unknown): Prefs {
  if (!patch || typeof patch !== "object") return current;
  const source = patch as Record<string, unknown>;
  return normalizePrefs({
    tab: source.tab ?? current.tab,
    settings: source.settings && typeof source.settings === "object" ? { ...current.settings, ...source.settings } : current.settings,
    units: { ...current.units, ...(source.units && typeof source.units === "object" ? source.units : {}) },
    history: source.history ?? current.history,
    fields: { ...current.fields, ...(source.fields && typeof source.fields === "object" ? source.fields : {}) },
  });
}

export function pushHistory(history: string[], entry: string): string[] {
  const trimmed = entry.trim();
  if (!trimmed) return history;
  return [trimmed, ...history.filter((item) => item !== trimmed)].slice(0, MAX_HISTORY);
}
