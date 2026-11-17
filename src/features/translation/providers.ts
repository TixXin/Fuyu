import {
  registerTranslationEngine,
  subscribeTranslationEngines,
  translationEngines,
  type CustomTranslationEngineSpec,
} from "./host/engines.mjs";

export const TRANSLATION_PROVIDERS = [
  "deepseek",
  "volcengine",
  "dashscope",
  "moonshot",
  "siliconflow",
  "openai",
  "custom",
] as const;

export type BuiltinTranslationProvider = (typeof TRANSLATION_PROVIDERS)[number];
export type TranslationProvider = BuiltinTranslationProvider | (string & {});

export const DEFAULT_TRANSLATION_PROVIDER: BuiltinTranslationProvider = "siliconflow";
export const LEGACY_TRANSLATION_PROVIDER: BuiltinTranslationProvider = "deepseek";

export const DEFAULT_PROVIDER_MODELS: Partial<Record<BuiltinTranslationProvider, string>> = {
  deepseek: "deepseek-flash",
};

export function isBuiltinTranslationProvider(value: unknown): value is BuiltinTranslationProvider {
  return TRANSLATION_PROVIDERS.includes(value as BuiltinTranslationProvider);
}

export function isTranslationProvider(value: unknown): value is TranslationProvider {
  return isBuiltinTranslationProvider(value) || translationEngines.has(value);
}

export { registerTranslationEngine, subscribeTranslationEngines, translationEngines, type CustomTranslationEngineSpec };
