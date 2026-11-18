import type { LocaleCode, Translations } from "./types";
import en from "./locales/en.ts";
import zhCN from "./locales/zh-CN.ts";

export const TRANSLATIONS: Record<LocaleCode, Translations> = {
  "zh-CN": zhCN,
  en,
};
