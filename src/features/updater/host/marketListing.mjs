const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

const timeOf = (value) => {
  const time = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : null;
};

export function versionIcon(entry) {
  const url = isObject(entry?.icon) ? entry.icon.url : null;
  return typeof url === "string" && url.startsWith("https://") ? url : null;
}

export function pluginIcon(plugin, preferred) {
  const own = versionIcon(preferred);
  if (own) return own;
  for (const entry of Array.isArray(plugin?.versions) ? plugin.versions : []) {
    const url = versionIcon(entry);
    if (url) return url;
  }
  return null;
}

function earliest(entries) {
  let best = null;
  for (const entry of entries) {
    const time = timeOf(entry?.publishedAt);
    if (time !== null && (best === null || time < best.time)) best = { time, at: entry.publishedAt };
  }
  return best?.at ?? null;
}

export function firstPublishedAt(plugin) {
  return earliest(Array.isArray(plugin?.versions) ? plugin.versions : []);
}

export function marketSince(doc) {
  const plugins = Array.isArray(doc?.plugins) ? doc.plugins : [];
  return earliest(plugins.flatMap((plugin) => (Array.isArray(plugin?.versions) ? plugin.versions : [])));
}

export function packageIcon(raw) {
  if (typeof raw !== "string") return undefined;
  const text = raw.trim().replace(/^\.\//, "");
  if (!text || text.startsWith("/") || text.includes("\\") || text.includes(":") || /[\u0000-\u001f\u007f]/.test(text)) return undefined;
  const parts = text.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return undefined;
  return parts.join("/");
}

const names = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === "string" && item) : []);

export function packageReach(fuyu) {
  const inject = fuyu?.inject;
  const services = Array.isArray(inject) ? names(inject) : isObject(inject) ? [...names(inject.required), ...names(inject.optional)] : [];
  return { slots: names(fuyu?.slots), services, config: fuyu?.config !== undefined && fuyu?.config !== null };
}
