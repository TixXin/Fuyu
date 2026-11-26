import type { LocaleCode, Translations } from "./types";

const devModules =
  import.meta.env && import.meta.env.DEV
    ? import.meta.glob<{ TRANSLATIONS: Record<LocaleCode, Translations> }>("./translations.ts", { eager: true })
    : undefined;

export const devTranslations = devModules?.["./translations.ts"]?.TRANSLATIONS;
