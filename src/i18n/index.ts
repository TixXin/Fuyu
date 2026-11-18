export type { LocaleCode, Translations } from "./types";
export {
  FALLBACK_LOCALE,
  I18nProvider,
  LOCALE_CODES,
  LOCALE_LABELS,
  LOCALE_STORAGE_KEY,
  detectLocale,
  getLoadedI18n,
  hasLoadedI18n,
  isLocaleCode,
  loadLocale,
  preloadI18n,
  saveLocale,
  useErrorText,
  useLocale,
  useTranslation,
} from "./runtime.ts";
export { TRANSLATIONS } from "./translations.ts";
