export type SlotTitle = string | Readonly<Record<string, string>>;

const clean = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

export function localizedTitle(title: unknown, locale: string): string | null {
  if (typeof title === "string") return clean(title);
  if (title === null || typeof title !== "object" || Array.isArray(title)) return null;
  const table = title as Record<string, unknown>;
  const language = locale.split("-")[0];
  const preferred = [locale, language, locale === "en" ? "zh-CN" : "en", "zh-CN", "en"];
  for (const key of preferred) {
    const text = clean(table[key]);
    if (text) return text;
  }
  for (const value of Object.values(table)) {
    const text = clean(value);
    if (text) return text;
  }
  return null;
}

export function packageLabel(id: string): string {
  const bare = id.includes("/") ? id.slice(id.lastIndexOf("/") + 1) : id;
  return bare.trim() || id;
}
