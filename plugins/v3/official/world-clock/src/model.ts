import { findCityByZone } from "./cities.ts";

export type WorldCity = {
  id: string;
  timeZone: string;
  labelZh: string;
  labelEn: string;
  shortCode: string;
  pinned: boolean;
  name?: string;
};

export type TimeFormat = "system" | "24" | "12";
export type DateMode = "none" | "relative" | "always";
export type DiffMode = "long" | "short" | "none";
export type BarStyle = "name" | "code" | "time";

export type WorldClockSettings = {
  timeFormat: TimeFormat;
  showSeconds: boolean;
  dateMode: DateMode;
  diffMode: DiffMode;
  showDayNight: boolean;
  showTimeZone: boolean;
  showLocal: boolean;
  showInBar: boolean;
  barStyle: BarStyle;
};

export type WorldClockSnapshot = {
  cities: WorldCity[];
  settings: WorldClockSettings;
  at: number;
};

export type StoredWorldClock = WorldClockSettings & { cities: WorldCity[] };

export const MAX_CITIES = 24;
export const MAX_NAME = 24;

export const TOPICS = {
  snapshot: "world-clock:snapshot",
} as const;

export const METHODS = {
  snapshot: "world-clock:get",
  add: "world-clock:add",
  remove: "world-clock:remove",
  focus: "world-clock:focus",
  move: "world-clock:move",
  rename: "world-clock:rename",
  setSettings: "world-clock:set-settings",
} as const;

export const DEFAULT_SETTINGS: WorldClockSettings = {
  timeFormat: "system",
  showSeconds: false,
  dateMode: "relative",
  diffMode: "long",
  showDayNight: true,
  showTimeZone: false,
  showLocal: false,
  showInBar: true,
  barStyle: "name",
};

export const DEFAULT_CITIES: readonly WorldCity[] = [
  { id: "preset-tyo", timeZone: "Asia/Tokyo", labelZh: "东京", labelEn: "Tokyo", shortCode: "TYO", pinned: true },
  { id: "preset-lon", timeZone: "Europe/London", labelZh: "伦敦", labelEn: "London", shortCode: "LON", pinned: false },
  { id: "preset-nyc", timeZone: "America/New_York", labelZh: "纽约", labelEn: "New York", shortCode: "NYC", pinned: false },
];

const CHOICES = {
  timeFormat: ["system", "24", "12"],
  dateMode: ["none", "relative", "always"],
  diffMode: ["long", "short", "none"],
  barStyle: ["name", "code", "time"],
} as const;

const FLAGS = ["showSeconds", "showDayNight", "showTimeZone", "showLocal", "showInBar"] as const;

export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function deriveNames(timeZone: string): { labelZh: string; labelEn: string; shortCode: string } {
  const city = findCityByZone(timeZone);
  if (city) return { labelZh: city.zh, labelEn: city.en, shortCode: city.code };
  const tail = (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");
  const code = tail.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "CLK";
  return { labelZh: tail, labelEn: tail, shortCode: code };
}

function cleanName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, MAX_NAME);
  return trimmed || undefined;
}

export function normalizeSettings(raw: unknown, base: WorldClockSettings = DEFAULT_SETTINGS): WorldClockSettings {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const next: WorldClockSettings = { ...base };
  for (const key of FLAGS) {
    if (typeof source[key] === "boolean") next[key] = source[key];
  }
  for (const key of Object.keys(CHOICES) as (keyof typeof CHOICES)[]) {
    const value = source[key];
    if ((CHOICES[key] as readonly unknown[]).includes(value)) (next as Record<string, unknown>)[key] = value;
  }
  return next;
}

function normalizeCity(item: unknown): WorldCity | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.timeZone !== "string" || !isValidTimeZone(raw.timeZone)) return null;
  const fallback = deriveNames(raw.timeZone);
  const city: WorldCity = {
    id: raw.id,
    timeZone: raw.timeZone,
    labelZh: cleanName(raw.labelZh) ?? fallback.labelZh,
    labelEn: cleanName(raw.labelEn) ?? fallback.labelEn,
    shortCode: typeof raw.shortCode === "string" && raw.shortCode.trim() ? raw.shortCode.trim().slice(0, 4) : fallback.shortCode,
    pinned: raw.pinned === true,
  };
  const name = cleanName(raw.name);
  if (name) city.name = name;
  return city;
}

export function normalizeStored(raw: unknown): StoredWorldClock {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const settings = normalizeSettings(source);
  if (!Array.isArray(source.cities)) return { ...settings, cities: DEFAULT_CITIES.map((city) => ({ ...city })) };
  const cities: WorldCity[] = [];
  for (const item of source.cities) {
    const city = normalizeCity(item);
    if (city && !cities.some((other) => other.id === city.id)) cities.push(city);
    if (cities.length >= MAX_CITIES) break;
  }
  let seenPinned = false;
  for (const city of cities) {
    if (city.pinned && seenPinned) city.pinned = false;
    if (city.pinned) seenPinned = true;
  }
  return { ...settings, cities };
}

export function moveCity(cities: readonly WorldCity[], id: string, to: number): WorldCity[] {
  const from = cities.findIndex((city) => city.id === id);
  if (from < 0) return [...cities];
  const next = [...cities];
  const [item] = next.splice(from, 1);
  const target = Math.max(0, Math.min(next.length, Math.trunc(Number.isFinite(to) ? to : from)));
  next.splice(target, 0, item);
  return next;
}

export function renameCity(cities: readonly WorldCity[], id: string, name: unknown): WorldCity[] {
  return cities.map((city) => {
    if (city.id !== id) return city;
    const { name: _old, ...rest } = city;
    const clean = cleanName(name);
    return clean ? { ...rest, name: clean } : rest;
  });
}

export function focusCity(cities: readonly WorldCity[], id: string): WorldCity[] {
  if (!cities.some((city) => city.id === id)) return [...cities];
  return cities.map((city) => ({ ...city, pinned: city.id === id }));
}

export function primaryCity(cities: readonly WorldCity[]): WorldCity | null {
  return cities.find((city) => city.pinned) ?? cities[0] ?? null;
}

export function cityLabel(city: Pick<WorldCity, "labelZh" | "labelEn" | "name">, zh: boolean): string {
  return city.name ?? (zh ? city.labelZh : city.labelEn);
}
