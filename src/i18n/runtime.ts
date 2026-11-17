import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { errorText } from "./nativeError.ts";
import type { LocaleCode, Translations } from "./types";

export const LOCALE_STORAGE_KEY = "fuyu-locale";

export const LOCALE_LABELS: Record<LocaleCode, string> = {
  "zh-CN": "简体中文",
  en: "English",
};

export const LOCALE_CODES: LocaleCode[] = ["zh-CN", "en"];

export const FALLBACK_LOCALE: LocaleCode = "zh-CN";

export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LOCALE_LABELS, value);
}

export function detectLocale(languages: readonly string[]): LocaleCode {
  for (const candidate of languages) {
    const normalized = candidate.toLowerCase();
    const supported = LOCALE_CODES.find((code) => code.toLowerCase() === normalized);
    if (supported) return supported;
    const base = normalized.split("-")[0];
    if (base === "zh") return "zh-CN";
    if (isLocaleCode(base)) return base;
  }
  return FALLBACK_LOCALE;
}

export function loadLocale(): LocaleCode {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocaleCode(stored)) return stored;
  } catch {
  }
  return detectLocale([...(navigator.languages ?? []), navigator.language]);
}

export function saveLocale(locale: LocaleCode) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
  }
}

type LoadedSlices = {
  dictionary: Translations;
  hasSettings: boolean;
  hasOnboarding: boolean;
};

const loaded = new Map<LocaleCode, LoadedSlices>();
const devModules = import.meta.env?.DEV
  ? import.meta.glob<{ TRANSLATIONS: Record<LocaleCode, Translations> }>("./translations.ts", { eager: true })
  : undefined;

function needsSettingsSlice(windowKind: string | null): boolean {
  return windowKind === "settings" || windowKind === "onboarding";
}

function needsOnboardingSlice(windowKind: string | null): boolean {
  return windowKind === null || windowKind === "onboarding";
}

export function hasLoadedI18n(locale: LocaleCode, windowKind: string | null): boolean {
  const entry = loaded.get(locale);
  if (!entry) return Boolean(devModules?.["./translations.ts"]);
  if (needsSettingsSlice(windowKind) && !entry.hasSettings) return false;
  if (needsOnboardingSlice(windowKind) && !entry.hasOnboarding) return false;
  return true;
}

async function loadCore(locale: LocaleCode): Promise<Translations> {
  if (locale === "en") return (await import("./locales/core-en.ts")).coreEn;
  return (await import("./locales/core-zh-CN.ts")).coreZhCN;
}

async function loadSettingsSlice(locale: LocaleCode) {
  if (locale === "en") return import("./locales/settings-en.ts");
  return import("./locales/settings-zh-CN.ts");
}

async function loadOnboardingSlice(locale: LocaleCode) {
  if (locale === "en") return import("./locales/onboarding-en.ts");
  return import("./locales/onboarding-zh-CN.ts");
}

export async function preloadI18n(locale: LocaleCode, windowKind: string | null): Promise<Translations> {
  const existing = loaded.get(locale);
  const wantSettings = needsSettingsSlice(windowKind);
  const wantOnboarding = needsOnboardingSlice(windowKind);
  const [base, settingsMod, onboardingMod] = await Promise.all([
    existing ? Promise.resolve(existing.dictionary) : loadCore(locale),
    wantSettings && !existing?.hasSettings ? loadSettingsSlice(locale) : Promise.resolve(null),
    wantOnboarding && !existing?.hasOnboarding ? loadOnboardingSlice(locale) : Promise.resolve(null),
  ]);
  const dictionary: Translations = {
    ...base,
    ...(settingsMod ? { settings: settingsMod.settings, sync: settingsMod.sync } : {}),
    ...(onboardingMod ? { onboarding: onboardingMod.onboarding } : {}),
  };
  loaded.set(locale, {
    dictionary,
    hasSettings: Boolean(existing?.hasSettings || settingsMod),
    hasOnboarding: Boolean(existing?.hasOnboarding || onboardingMod),
  });
  return dictionary;
}

export function getLoadedI18n(locale: LocaleCode): Translations | undefined {
  return loaded.get(locale)?.dictionary;
}

function resolveDictionary(locale: LocaleCode): Translations {
  const ready = loaded.get(locale)?.dictionary ?? loaded.get(FALLBACK_LOCALE)?.dictionary;
  if (ready) return ready;
  const fallback = devModules?.["./translations.ts"]?.TRANSLATIONS;
  if (fallback) return fallback[locale] ?? fallback[FALLBACK_LOCALE];
  throw new Error(`Translations for ${locale} were used before preloadI18n completed`);
}

function currentWindowKind(): string | null {
  return typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("window");
}

const TranslationContext = createContext<Translations | null>(null);
const LocaleContext = createContext<{ locale: LocaleCode; setLocale: (locale: LocaleCode) => void }>({
  locale: FALLBACK_LOCALE,
  setLocale: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<LocaleCode>(loadLocale);
  const switchLocale = useCallback((next: LocaleCode) => {
    const kind = currentWindowKind();
    if (hasLoadedI18n(next, kind)) {
      updateLocale(next);
      return;
    }
    void preloadI18n(next, kind).then(() => updateLocale(next));
  }, []);
  const setLocale = useCallback((next: LocaleCode) => {
    if (!isLocaleCode(next)) return;
    saveLocale(next);
    switchLocale(next);
  }, [switchLocale]);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => {
    const syncLocale = (event: StorageEvent) => {
      if (event.key === LOCALE_STORAGE_KEY || event.key === null) switchLocale(loadLocale());
    };
    window.addEventListener("storage", syncLocale);
    return () => window.removeEventListener("storage", syncLocale);
  }, [switchLocale]);

  return createElement(LocaleContext.Provider, { value },
    createElement(TranslationContext.Provider, { value: resolveDictionary(locale) }, children));
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useTranslation(): Translations {
  return useContext(TranslationContext) ?? resolveDictionary(FALLBACK_LOCALE);
}

export function useErrorText() {
  const t = useTranslation();
  return useCallback((error: unknown) => errorText(error, t), [t]);
}
