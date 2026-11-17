import type { ServiceDefinition } from "../define.mjs";

export type BuiltinTranslationEngine = "deepseek" | "volcengine" | "dashscope" | "moonshot" | "siliconflow" | "openai" | "custom";

export type TranslationEngine = BuiltinTranslationEngine | (string & {});

export type Direction = "auto" | "zh-en" | "en-zh";

export type RewriteTask = "summarize" | "polish" | "grammar" | "translate" | "custom";

export type EngineChoice = {
  engine: TranslationEngine;
  model?: string | null;
};

export type TranslatorEngineLabel = {
  "zh-CN": string;
  en: string;
};

export type TranslatorEngineInfo = {
  engine: TranslationEngine;
  hasSecret: boolean;
  label?: TranslatorEngineLabel;
  defaultModel?: string;
};

export type TranslatorErrorCode = "no-secret" | "no-address" | "engine-failed" | "empty-text" | "unsupported";

export type TranslatorMethods = {
  translate(params: { text: string; direction?: Direction; engine?: EngineChoice }): { text: string; engine: TranslationEngine };
  rewrite(params: { text: string; task: RewriteTask; prompt?: string; engine?: EngineChoice }): { text: string; engine: TranslationEngine };
  engines(): { engines: TranslatorEngineInfo[] };
};

export type TranslatorEvents = {
  changed: Record<string, never>;
};

export type TranslatorProgress = {
  rewrite: { piece: string };
};

export const translatorV1: ServiceDefinition<TranslatorMethods, TranslatorEvents, TranslatorProgress>;
