export const MAX_AUTO_UPDATED = 50;

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const isVersion = (value) => typeof value === "string" && value.length > 0;

function normalizeName(raw) {
  if (!isObject(raw)) return null;
  const out = {};
  for (const [locale, text] of Object.entries(raw)) {
    if (typeof text === "string" && text.trim()) out[locale] = text;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function normalizeItem(raw) {
  if (!isObject(raw) || typeof raw.name !== "string" || !raw.name || !isVersion(raw.from) || !isVersion(raw.to)) return null;
  const displayName = normalizeName(raw.displayName);
  return { name: raw.name, ...(displayName ? { displayName } : {}), from: raw.from, to: raw.to };
}

export function normalizeAutoUpdated(raw) {
  if (!isObject(raw) || typeof raw.at !== "number" || !Array.isArray(raw.plugins)) return null;
  const plugins = raw.plugins.map(normalizeItem).filter(Boolean).slice(0, MAX_AUTO_UPDATED);
  return plugins.length > 0 ? { at: raw.at, plugins } : null;
}

export function mergeAutoUpdated(previous, upgraded, at) {
  const fresh = (Array.isArray(upgraded) ? upgraded : []).map(normalizeItem).filter(Boolean);
  const kept = normalizeAutoUpdated(previous);
  if (fresh.length === 0) return kept;
  const byName = new Map((kept?.plugins ?? []).map((item) => [item.name, item]));
  for (const item of fresh) {
    const before = byName.get(item.name);
    byName.delete(item.name);
    byName.set(item.name, before ? { ...item, from: before.from } : item);
  }
  return { at, plugins: [...byName.values()].slice(-MAX_AUTO_UPDATED) };
}

export function dismissAutoUpdated(current, at) {
  const kept = normalizeAutoUpdated(current);
  return kept && typeof at === "number" && kept.at > at ? kept : null;
}
