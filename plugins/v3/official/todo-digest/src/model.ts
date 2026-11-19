export const METHODS = {
  state: "state",
  writeDigest: "writeDigest",
  setSettings: "setSettings",
} as const;

export const TOPICS = {
  state: "state",
} as const;

export type DigestScope = "open" | "openCount" | "all";
export type DigestFormat = "list" | "checkbox";

export type DigestSettings = {
  autoWrite: boolean;
  autoTime: string;
  scope: DigestScope;
  format: DigestFormat;
  replace: boolean;
  writeWhenDone: boolean;
  notify: boolean;
};

export const DEFAULT_SETTINGS: DigestSettings = {
  autoWrite: false,
  autoTime: "22:00",
  scope: "open",
  format: "list",
  replace: true,
  writeWhenDone: true,
  notify: true,
};

export type DigestTodo = {
  id: string;
  title: string;
  completed: boolean;
  project?: string;
};

export type WriteOutcome = "written" | "replaced" | "skipped";

export type LastWrite = { date: string; block: string; at: number };

export type DigestState = {
  date: string;
  total: number;
  openCount: number;
  todos: DigestTodo[];
  settings: DigestSettings;
  lastWrittenAt: number | null;
  lastOutcome: WriteOutcome | null;
  error: string | null;
  at: number;
};

export const EMPTY_STATE: DigestState = {
  date: "",
  total: 0,
  openCount: 0,
  todos: [],
  settings: DEFAULT_SETTINGS,
  lastWrittenAt: null,
  lastOutcome: null,
  error: null,
  at: 0,
};

export type StoredDigest = {
  settings: DigestSettings;
  lastWrite: LastWrite | null;
  lastAutoDate: string | null;
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const flag = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

export function isValidTime(value: unknown): value is string {
  return typeof value === "string" && TIME.test(value);
}

export function normalizeSettings(patch: unknown, base: DigestSettings = DEFAULT_SETTINGS): DigestSettings {
  const raw = patch && typeof patch === "object" ? (patch as Record<string, unknown>) : {};
  return {
    autoWrite: flag(raw.autoWrite, base.autoWrite),
    autoTime: isValidTime(raw.autoTime) ? raw.autoTime : base.autoTime,
    scope: pick(raw.scope, ["open", "openCount", "all"] as const, base.scope),
    format: pick(raw.format, ["list", "checkbox"] as const, base.format),
    replace: flag(raw.replace, base.replace),
    writeWhenDone: flag(raw.writeWhenDone, base.writeWhenDone),
    notify: flag(raw.notify, base.notify),
  };
}

function normalizeLastWrite(value: unknown): LastWrite | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.date !== "string" || !DATE.test(raw.date)) return null;
  if (typeof raw.block !== "string" || raw.block.length === 0) return null;
  if (typeof raw.at !== "number" || !Number.isFinite(raw.at)) return null;
  return { date: raw.date, block: raw.block, at: raw.at };
}

export function normalizeStored(value: unknown): StoredDigest {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    settings: normalizeSettings(raw.settings),
    lastWrite: normalizeLastWrite(raw.lastWrite),
    lastAutoDate: typeof raw.lastAutoDate === "string" && DATE.test(raw.lastAutoDate) ? raw.lastAutoDate : null,
  };
}

export function dateKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function clockOf(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function autoWriteDue(settings: DigestSettings, lastAutoDate: string | null, at: number): boolean {
  if (!settings.autoWrite) return false;
  if (lastAutoDate === dateKey(at)) return false;
  return clockOf(at) >= settings.autoTime;
}
