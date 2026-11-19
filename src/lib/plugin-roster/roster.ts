export const ROSTER_KEY = "fuyu-market-plugins";
export const ROSTER_LOCAL_KEY = "fuyu-market-plugins-local";
export const MAX_ROSTER_CONFIG_BYTES = 16 * 1024;

export type RosterSource = "market" | "manual";
export type RosterConfig = Record<string, unknown>;

export type RosterItem = {
  id: string;
  source: RosterSource;
  enabled: boolean;
  config?: RosterConfig;
  configOmitted?: "tooLarge";
};

export type InstalledPlugin = {
  id: string;
  source: RosterSource;
  enabled: boolean;
  config: RosterConfig | null;
};

export type RosterLocal = {
  seen: Record<string, string>;
  dismissed: string[];
};

export type RosterGaps = {
  missing: RosterItem[];
  manual: RosterItem[];
  differing: RosterItem[];
};

const PLUGIN_ID = /^@[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SECRET_WORDS = ["password", "passwd", "token", "secret", "authcode", "apikey", "credential"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isRosterId(id: unknown): id is string {
  return typeof id === "string" && PLUGIN_ID.test(id) && !id.split("/").some((part) => part.endsWith("."));
}

function looksSecret(field: string) {
  const plain = field.toLowerCase().replace(/[-_]/g, "");
  return SECRET_WORDS.some((word) => plain.includes(word));
}

function tidy(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(tidy);
  if (!isPlainObject(value)) return value;
  const next: Record<string, unknown> = {};
  for (const field of Object.keys(value).sort()) {
    if (!looksSecret(field) && value[field] !== undefined) next[field] = tidy(value[field]);
  }
  return next;
}

export function scrubConfig(config: RosterConfig): RosterConfig {
  return tidy(config) as RosterConfig;
}

function byteLength(text: string) {
  return new TextEncoder().encode(text).length;
}

function withConfig(item: RosterItem, config: unknown): RosterItem {
  if (item.source !== "market" || !isPlainObject(config)) return item;
  const clean = scrubConfig(config);
  if (Object.keys(clean).length === 0) return item;
  if (byteLength(JSON.stringify(clean)) > MAX_ROSTER_CONFIG_BYTES) return { ...item, configOmitted: "tooLarge" };
  return { ...item, config: clean };
}

export function rosterItemOf(plugin: InstalledPlugin): RosterItem {
  return withConfig({ id: plugin.id, source: plugin.source, enabled: plugin.enabled }, plugin.config);
}

export function normalizeRoster(value: unknown): RosterItem[] {
  if (!Array.isArray(value)) return [];
  const items: RosterItem[] = [];
  const taken = new Set<string>();
  for (const raw of value as unknown[]) {
    if (!isPlainObject(raw) || !isRosterId(raw.id) || taken.has(raw.id)) continue;
    taken.add(raw.id);
    const base: RosterItem = { id: raw.id, source: raw.source === "manual" ? "manual" : "market", enabled: raw.enabled !== false };
    const item = withConfig(base, raw.config);
    items.push(raw.configOmitted === "tooLarge" && item.source === "market" && !item.config ? { ...item, configOmitted: "tooLarge" } : item);
  }
  return items;
}

export function parseRoster(text: string | null | undefined): RosterItem[] {
  if (typeof text !== "string") return [];
  try {
    return normalizeRoster(JSON.parse(text));
  } catch {
    return [];
  }
}

export function normalizeRosterLocal(value: unknown): RosterLocal {
  const raw = isPlainObject(value) ? value : {};
  const seen: Record<string, string> = {};
  if (isPlainObject(raw.seen)) {
    for (const [id, print] of Object.entries(raw.seen)) {
      if (isRosterId(id) && typeof print === "string") seen[id] = print;
    }
  }
  const dismissed = Array.isArray(raw.dismissed) ? [...new Set((raw.dismissed as unknown[]).filter(isRosterId))].sort() : [];
  return { seen, dismissed };
}

export function rosterPrint(item: RosterItem): string {
  const text = JSON.stringify([item.id, item.source, item.enabled, item.config ?? null, item.configOmitted ?? null]);
  let hash = 0x811c9dc5;
  for (let at = 0; at < text.length; at += 1) {
    hash ^= text.charCodeAt(at);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(16)}:${text.length}`;
}

export function sameRoster(a: readonly RosterItem[], b: readonly RosterItem[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function reconcileRoster(roster: readonly RosterItem[], local: RosterLocal, installed: readonly InstalledPlugin[]) {
  const next = new Map(roster.map((item) => [item.id, item]));
  const seen: Record<string, string> = {};
  const dismissed = new Set(local.dismissed);
  for (const plugin of installed) {
    if (!isRosterId(plugin.id)) continue;
    const item = rosterItemOf(plugin);
    const print = rosterPrint(item);
    const known = local.seen[plugin.id];
    if (!next.has(plugin.id) || (known !== undefined && known !== print)) next.set(plugin.id, item);
    seen[plugin.id] = print;
    dismissed.delete(plugin.id);
  }
  for (const id of Object.keys(local.seen)) {
    if (id in seen) continue;
    next.delete(id);
    dismissed.add(id);
  }
  const nextRoster = [...next.values()];
  const nextLocal: RosterLocal = { seen, dismissed: [...dismissed].sort() };
  return {
    roster: nextRoster,
    local: nextLocal,
    rosterChanged: !sameRoster(roster, nextRoster),
    localChanged: localText(local) !== localText(nextLocal),
  };
}

function localText(local: RosterLocal) {
  return JSON.stringify([Object.keys(local.seen).sort().map((id) => [id, local.seen[id]]), [...local.dismissed].sort()]);
}

function configDiffers(wanted: RosterConfig, current: RosterConfig | undefined) {
  return Object.keys(wanted).some((field) => JSON.stringify(wanted[field]) !== JSON.stringify(current?.[field]));
}

export function rosterGaps(roster: readonly RosterItem[], local: RosterLocal, installed: readonly InstalledPlugin[]): RosterGaps {
  const here = new Map(installed.map((plugin) => [plugin.id, plugin]));
  const gaps: RosterGaps = { missing: [], manual: [], differing: [] };
  for (const item of roster) {
    const plugin = here.get(item.id);
    if (!plugin) {
      if (!local.dismissed.includes(item.id)) (item.source === "manual" ? gaps.manual : gaps.missing).push(item);
      continue;
    }
    if (item.source !== "market" || plugin.source !== "market" || !item.config || plugin.config === null) continue;
    const mine = rosterItemOf(plugin);
    if (mine.configOmitted !== "tooLarge" && configDiffers(item.config, mine.config)) gaps.differing.push(item);
  }
  return gaps;
}

export function dismissRosterItems(local: RosterLocal, ids: readonly string[]): RosterLocal {
  return { seen: local.seen, dismissed: [...new Set([...local.dismissed, ...ids.filter(isRosterId)])].sort() };
}

export function keepLocalConfig(roster: readonly RosterItem[], installed: readonly InstalledPlugin[], ids: readonly string[]): RosterItem[] {
  const here = new Map(installed.map((plugin) => [plugin.id, plugin]));
  return roster.map((item) => {
    const plugin = here.get(item.id);
    return plugin && ids.includes(item.id) ? rosterItemOf(plugin) : item;
  });
}
