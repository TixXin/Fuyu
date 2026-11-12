export const TRANSLATION_PROVIDERS = [
  "deepseek",
  "volcengine",
  "dashscope",
  "moonshot",
  "siliconflow",
  "openai",
  "custom",
] as const;

export type TranslationProvider = (typeof TRANSLATION_PROVIDERS)[number];

export const DEFAULT_TRANSLATION_PROVIDER: TranslationProvider = "siliconflow";
export const LEGACY_TRANSLATION_PROVIDER: TranslationProvider = "deepseek";

export const DEFAULT_PROVIDER_MODELS: Partial<Record<TranslationProvider, string>> = {
  deepseek: "deepseek-flash",
};

export function isTranslationProvider(value: unknown): value is TranslationProvider {
  return TRANSLATION_PROVIDERS.includes(value as TranslationProvider);
}
