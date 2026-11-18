export type WorldCity = {
  id: string;
  timeZone: string;
  labelZh: string;
  labelEn: string;
  shortCode: string;
  pinned: boolean;
};

export type WorldClockSnapshot = {
  cities: WorldCity[];
  showInBar: boolean;
  at: number;
};

export const TOPICS = {
  snapshot: "world-clock:snapshot",
} as const;

export const METHODS = {
  snapshot: "world-clock:get",
  add: "world-clock:add",
  remove: "world-clock:remove",
  pin: "world-clock:pin",
  setShowInBar: "world-clock:set-show-in-bar",
} as const;

export type PresetCity = {
  timeZone: string;
  labelZh: string;
  labelEn: string;
  shortCode: string;
};

export const PRESET_CITIES: readonly PresetCity[] = [
  { timeZone: "Asia/Shanghai", labelZh: "上海", labelEn: "Shanghai", shortCode: "SHA" },
  { timeZone: "Asia/Tokyo", labelZh: "东京", labelEn: "Tokyo", shortCode: "TYO" },
  { timeZone: "Asia/Singapore", labelZh: "新加坡", labelEn: "Singapore", shortCode: "SIN" },
  { timeZone: "Europe/London", labelZh: "伦敦", labelEn: "London", shortCode: "LON" },
  { timeZone: "Europe/Paris", labelZh: "巴黎", labelEn: "Paris", shortCode: "PAR" },
  { timeZone: "America/New_York", labelZh: "纽约", labelEn: "New York", shortCode: "NYC" },
  { timeZone: "America/Los_Angeles", labelZh: "洛杉矶", labelEn: "Los Angeles", shortCode: "LAX" },
  { timeZone: "Australia/Sydney", labelZh: "悉尼", labelEn: "Sydney", shortCode: "SYD" },
  { timeZone: "UTC", labelZh: "协调世界时", labelEn: "UTC", shortCode: "UTC" },
];

export const DEFAULT_CITIES: readonly WorldCity[] = [
  { id: "preset-tyo", timeZone: "Asia/Tokyo", labelZh: "东京", labelEn: "Tokyo", shortCode: "TYO", pinned: true },
  { id: "preset-lon", timeZone: "Europe/London", labelZh: "伦敦", labelEn: "London", shortCode: "LON", pinned: false },
  { id: "preset-nyc", timeZone: "America/New_York", labelZh: "纽约", labelEn: "New York", shortCode: "NYC", pinned: false },
];

export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function zoneParts(at: number, timeZone?: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(at));
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = Number(part.value);
  }
  return {
    year: map.year ?? 1970,
    month: map.month ?? 1,
    day: map.day ?? 1,
    hour: (map.hour ?? 0) % 24,
    minute: map.minute ?? 0,
  };
}

export function formatZoneClock(at: number, timeZone: string): {
  hhmm: string;
  offsetHours: number;
  dayDiff: -1 | 0 | 1;
  isDaytime: boolean;
} {
  const z = zoneParts(at, timeZone);
  const local = zoneParts(at);
  const zEpochMin = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute) / 60_000;
  const lEpochMin = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute) / 60_000;
  const offsetHours = Math.round(((zEpochMin - lEpochMin) / 60) * 2) / 2;

  const zDay = Date.UTC(z.year, z.month - 1, z.day);
  const lDay = Date.UTC(local.year, local.month - 1, local.day);
  const dayDiff: -1 | 0 | 1 = zDay > lDay ? 1 : zDay < lDay ? -1 : 0;

  const hhmm = `${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;
  const isDaytime = z.hour >= 6 && z.hour < 18;
  return { hhmm, offsetHours, dayDiff, isDaytime };
}

export function primaryCity(cities: readonly WorldCity[]): WorldCity | null {
  return cities.find((city) => city.pinned) ?? cities[0] ?? null;
}
