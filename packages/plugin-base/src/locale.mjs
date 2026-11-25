export const DEFAULT_LOCALE = "zh-CN";

export function normalizeLocale(value) {
  if (typeof value === "string" && value.trim().toLowerCase().startsWith("en")) return "en";
  return DEFAULT_LOCALE;
}

const clean = (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

export function pickLocale(map, locale = DEFAULT_LOCALE) {
  if (typeof map === "string") return clean(map) ?? "";
  if (map === null || typeof map !== "object" || Array.isArray(map)) return "";
  const raw = typeof locale === "string" && locale.trim() !== "" ? locale.trim() : DEFAULT_LOCALE;
  const current = normalizeLocale(raw);
  const language = raw.split("-")[0];
  const preferred = [raw, current, language, current === "en" ? "zh-CN" : "en", "zh-CN", "en"];
  for (const key of preferred) {
    const text = clean(map[key]);
    if (text) return text;
  }
  for (const value of Object.values(map)) {
    const text = clean(value);
    if (text) return text;
  }
  return "";
}

export function createLocaleStore(initial = DEFAULT_LOCALE) {
  let current = normalizeLocale(initial);
  const listeners = new Set();
  return {
    current: () => current,
    set(next) {
      const normalized = normalizeLocale(next);
      if (normalized === current) return false;
      current = normalized;
      for (const listener of [...listeners]) {
        try {
          listener(current);
        } catch (error) {
          queueMicrotask(() => {
            throw error;
          });
        }
      }
      return true;
    },
    onChange(listener) {
      if (typeof listener !== "function") throw new TypeError("ctx.locale.onChange requires a listener function");
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    pick: (map) => pickLocale(map, current),
  };
}
