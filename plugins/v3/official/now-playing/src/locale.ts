export type Locale = "zh-CN" | "en";

export function currentLocale(): Locale {
  const fromNavigator = typeof navigator !== "undefined" && typeof navigator.language === "string" ? navigator.language : "";
  const language = fromNavigator || new Intl.DateTimeFormat().resolvedOptions().locale;
  return language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}
