export type Locale = "zh-CN" | "en";

export function currentLocale(): Locale {
  const language = typeof navigator !== "undefined" ? navigator.language : "";
  return language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}
