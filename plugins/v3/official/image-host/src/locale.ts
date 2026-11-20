export type Locale = "zh-CN" | "en";

export function currentLocale(): Locale {
  let language = typeof navigator !== "undefined" && typeof navigator.language === "string" ? navigator.language : "";
  if (!language) {
    try {
      language = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      language = "";
    }
  }
  return language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}
