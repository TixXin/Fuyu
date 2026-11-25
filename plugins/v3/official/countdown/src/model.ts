import {
  isValidDateKey,
  readItem,
  sortByDate,
  sortCountdownItems,
  type CalendarKind,
  type CountdownKind,
  type Reading,
} from "./days.ts";
import { lunarToSolarKey, normalizeLunarDate, solarToLunar, type LunarDate } from "./lunar.ts";

export { daysDelta, effectiveDate, isValidDateKey, parseLocalDate, primaryCountdown, resolveLunarRef, sortCountdownItems, startOfLocalDay } from "./days.ts";
export type { CalendarKind, CountdownKind, Reading } from "./days.ts";
export type { LunarDate } from "./lunar.ts";

export type CountdownItem = {
  id: string;
  title: string;
  date: string;
  calendar?: CalendarKind;
  lunar?: LunarDate;
  pinned: boolean;
  kind: CountdownKind;
  repeat: boolean;
  bgRev: number | null;
};

export type StoredItem = CountdownItem & { backgroundDataUrl: string | null };

export type SortOrder = "date" | "manual";
export type PastMode = "elapsed" | "hide" | "dim";
export type BarTarget = "pinned" | "nearest";
export type BarStyle = "days" | "icon" | "title";

export type CountdownSettings = {
  order: SortOrder;
  pageRows: number;
  showDate: boolean;
  pastMode: PastMode;
  remindOnDay: boolean;
  remindAhead: boolean;
  aheadDays: number;
  showInBar: boolean;
  barTarget: BarTarget;
  barStyle: BarStyle;
};

export type CountdownSnapshot = {
  items: CountdownItem[];
  settings: CountdownSettings;
  at: number;
};

export type Reminded = { day: string; ids: string[] };

export type StoredCountdown = CountdownSettings & { items: StoredItem[]; reminded: Reminded };

export type ItemDraft = {
  title?: unknown;
  date?: unknown;
  calendar?: unknown;
  lunar?: unknown;
  kind?: unknown;
  repeat?: unknown;
};

export const MAX_ITEMS = 200;
export const MAX_TITLE = 80;
export const MAX_BG_LENGTH = 700_000;
export const MAX_BG_FILE = 512_000;
export const PAGE_ROWS = [0, 3, 5, 10] as const;
export const AHEAD_DAYS = [1, 3, 7] as const;

export const TOPICS = {
  snapshot: "countdown:snapshot",
} as const;

export const METHODS = {
  snapshot: "countdown:get",
  add: "countdown:add",
  update: "countdown:update",
  remove: "countdown:remove",
  pin: "countdown:pin",
  move: "countdown:move",
  setBackground: "countdown:set-background",
  background: "countdown:background",
  setSettings: "countdown:set-settings",
} as const;

export const DEFAULT_SETTINGS: CountdownSettings = {
  order: "date",
  pageRows: 5,
  showDate: false,
  pastMode: "elapsed",
  remindOnDay: true,
  remindAhead: false,
  aheadDays: 1,
  showInBar: true,
  barTarget: "pinned",
  barStyle: "days",
};

const CHOICES = {
  order: ["date", "manual"],
  pastMode: ["elapsed", "hide", "dim"],
  barTarget: ["pinned", "nearest"],
  barStyle: ["days", "icon", "title"],
} as const;

const NUMBERS = {
  pageRows: PAGE_ROWS,
  aheadDays: AHEAD_DAYS,
} as const;

const FLAGS = ["showDate", "remindOnDay", "remindAhead", "showInBar"] as const;

export function normalizeSettings(raw: unknown, base: CountdownSettings = DEFAULT_SETTINGS): CountdownSettings {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const next: CountdownSettings = { ...base };
  const writable = next as Record<string, unknown>;
  for (const key of FLAGS) {
    if (typeof source[key] === "boolean") next[key] = source[key];
  }
  for (const key of Object.keys(CHOICES) as (keyof typeof CHOICES)[]) {
    if ((CHOICES[key] as readonly unknown[]).includes(source[key])) writable[key] = source[key];
  }
  for (const key of Object.keys(NUMBERS) as (keyof typeof NUMBERS)[]) {
    if ((NUMBERS[key] as readonly unknown[]).includes(source[key])) writable[key] = source[key];
  }
  return next;
}

export function sanitizeBackground(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("data:image/") || trimmed.length > MAX_BG_LENGTH) return null;
  return trimmed;
}

export function cleanTitle(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_TITLE) : "";
}

export function cleanKind(value: unknown, fallback: CountdownKind = "countdown"): CountdownKind {
  return value === "anniversary" || value === "countdown" ? value : fallback;
}

export function cleanCalendar(value: unknown, fallback: CalendarKind = "solar"): CalendarKind {
  return value === "lunar" || value === "solar" ? value : fallback;
}

export function resolveDateDraft(
  draft: Pick<ItemDraft, "date" | "calendar" | "lunar">,
  fallbackCalendar: CalendarKind = "solar",
): { date: string; calendar?: CalendarKind; lunar?: LunarDate } | null {
  const calendar = cleanCalendar(draft.calendar, fallbackCalendar);
  if (calendar === "lunar") {
    const lunar = normalizeLunarDate(draft.lunar) ?? (typeof draft.date === "string" && isValidDateKey(draft.date.trim()) ? solarToLunar(draft.date.trim()) : null);
    if (!lunar) return null;
    const solar = lunarToSolarKey(lunar.year, lunar.month, lunar.day, Boolean(lunar.leap), true);
    if (!solar) return null;
    return { date: solar, calendar: "lunar", lunar };
  }
  const date = typeof draft.date === "string" ? draft.date.trim() : "";
  if (!isValidDateKey(date)) return null;
  return { date };
}

function normalizeItem(entry: unknown): StoredItem | null {
  if (!entry || typeof entry !== "object") return null;
  const raw = entry as Record<string, unknown>;
  const title = cleanTitle(raw.title);
  if (typeof raw.id !== "string" || !title) return null;
  const resolved = resolveDateDraft({ date: raw.date, calendar: raw.calendar, lunar: raw.lunar });
  if (!resolved) return null;
  const backgroundDataUrl = sanitizeBackground(raw.backgroundDataUrl);
  const rev = typeof raw.bgRev === "number" && Number.isFinite(raw.bgRev) ? raw.bgRev : 1;
  return {
    id: raw.id,
    title,
    date: resolved.date,
    ...(resolved.calendar === "lunar" && resolved.lunar ? { calendar: "lunar" as const, lunar: resolved.lunar } : {}),
    pinned: raw.pinned === true,
    kind: cleanKind(raw.kind),
    repeat: raw.repeat === true,
    bgRev: backgroundDataUrl ? rev : null,
    backgroundDataUrl,
  };
}

export function normalizeStored(raw: unknown): StoredCountdown {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const items: StoredItem[] = [];
  for (const entry of Array.isArray(source.items) ? source.items : []) {
    const item = normalizeItem(entry);
    if (item && !items.some((other) => other.id === item.id)) items.push(item);
  }
  let seenPinned = false;
  for (const item of items) {
    if (item.pinned && seenPinned) item.pinned = false;
    if (item.pinned) seenPinned = true;
  }
  const rawReminded = source.reminded as Partial<Reminded> | undefined;
  const reminded: Reminded = {
    day: typeof rawReminded?.day === "string" ? rawReminded.day : "",
    ids: Array.isArray(rawReminded?.ids) ? rawReminded.ids.filter((id): id is string => typeof id === "string") : [],
  };
  return { ...normalizeSettings(source), items, reminded };
}

export function toView(item: StoredItem): CountdownItem {
  const { backgroundDataUrl: _bg, ...view } = item;
  return view;
}

export function moveItem<T extends { id: string }>(items: readonly T[], id: string, to: number): T[] {
  const from = items.findIndex((item) => item.id === id);
  if (from < 0) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  const target = Math.max(0, Math.min(next.length, Math.trunc(Number.isFinite(to) ? to : from)));
  next.splice(target, 0, item);
  return next;
}

export function togglePin<T extends { id: string; pinned: boolean }>(items: readonly T[], id: string): T[] {
  if (!items.some((item) => item.id === id)) return [...items];
  return items.map((item) => ({ ...item, pinned: item.id === id ? !item.pinned : false }));
}

export function applyDraft<T extends StoredItem>(item: T, draft: ItemDraft): T {
  const next = { ...item };
  const title = cleanTitle(draft.title);
  if (title) next.title = title;
  if (draft.date !== undefined || draft.calendar !== undefined || draft.lunar !== undefined) {
    const resolved = resolveDateDraft(
      {
        date: draft.date ?? item.date,
        calendar: draft.calendar ?? item.calendar,
        lunar: draft.lunar !== undefined ? draft.lunar : draft.calendar === "solar" ? undefined : item.lunar,
      },
      item.calendar ?? "solar",
    );
    if (resolved) {
      next.date = resolved.date;
      if (resolved.calendar === "lunar" && resolved.lunar) {
        next.calendar = "lunar";
        next.lunar = resolved.lunar;
      } else {
        delete next.calendar;
        delete next.lunar;
      }
    }
  }
  if (draft.kind !== undefined) next.kind = cleanKind(draft.kind, item.kind);
  if (typeof draft.repeat === "boolean") next.repeat = draft.repeat;
  return next;
}

export type PageView<T> = { hero: T | null; rows: T[]; hidden: number };

export function isPast(item: CountdownItem, at: number): boolean {
  return readItem(item, at).type === "past";
}

export function visibleItems<T extends CountdownItem>(items: readonly T[], settings: CountdownSettings, at: number): T[] {
  return settings.pastMode === "hide" ? items.filter((item) => !isPast(item, at)) : [...items];
}

export function pageView<T extends CountdownItem>(items: readonly T[], settings: CountdownSettings, at: number): PageView<T> {
  const visible = visibleItems(items, settings, at);
  const ordered = settings.order === "manual" ? visible : sortByDate(visible, at);
  const hero = ordered.find((item) => item.pinned) ?? ordered[0] ?? null;
  const rest = ordered.filter((item) => item !== hero);
  const rows = rest.slice(0, settings.pageRows);
  return { hero, rows, hidden: rest.length - rows.length };
}

export function barItem<T extends CountdownItem>(items: readonly T[], settings: CountdownSettings, at: number): T | null {
  const visible = visibleItems(items, settings, at);
  if (settings.barTarget === "pinned") return sortCountdownItems(visible, at)[0] ?? null;
  return sortByDate(visible, at)[0] ?? null;
}

export function readingOf(item: CountdownItem, at: number): Reading {
  return readItem(item, at);
}
