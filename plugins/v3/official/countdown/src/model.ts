export type CountdownItem = {
  id: string;
  title: string;
  date: string;
  pinned: boolean;
  backgroundDataUrl: string | null;
};

export type CountdownSnapshot = {
  items: CountdownItem[];
  showInBar: boolean;
  at: number;
};

export const TOPICS = {
  snapshot: "countdown:snapshot",
} as const;

export const METHODS = {
  snapshot: "countdown:get",
  add: "countdown:add",
  remove: "countdown:remove",
  pin: "countdown:pin",
  setBackground: "countdown:set-background",
  setShowInBar: "countdown:set-show-in-bar",
} as const;

export const MAX_BG_LENGTH = 700_000;

const DAY_MS = 86_400_000;

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function startOfLocalDay(timestamp: number): number {
  const dt = new Date(timestamp);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
}

export function parseLocalDate(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function daysDelta(dateKey: string, at: number): number {
  const target = parseLocalDate(dateKey);
  const today = startOfLocalDay(at);
  return Math.round((target - today) / DAY_MS);
}

export function sortCountdownItems(items: readonly CountdownItem[], at: number): CountdownItem[] {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const da = daysDelta(a.date, at);
    const db = daysDelta(b.date, at);
    const aUpcoming = da >= 0;
    const bUpcoming = db >= 0;
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    if (aUpcoming) return da - db;
    return db - da;
  });
}

export function primaryCountdown(items: readonly CountdownItem[], at: number): CountdownItem | null {
  const sorted = sortCountdownItems(items, at);
  return sorted[0] ?? null;
}

export function sanitizeBackground(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("data:image/") || trimmed.length > MAX_BG_LENGTH) return null;
  return trimmed;
}
