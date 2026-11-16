import type { ServiceDefinition } from "../define.mjs";

export type TranslationEngine = "deepseek" | "volcengine" | "dashscope" | "moonshot" | "siliconflow" | "openai" | "custom";

export type Direction = "auto" | "zh-en" | "en-zh";

export type RewriteTask = "summarize" | "polish" | "grammar" | "translate" | "custom";

export type EngineChoice = {
  engine: TranslationEngine;
  model?: string | null;
};

export type TranslatorErrorCode = "no-secret" | "no-address" | "engine-failed" | "empty-text";

export type TranslatorMethods = {
  translate(params: { text: string; direction: Direction; engine?: EngineChoice }): { text: string; engine: TranslationEngine };
  rewrite(params: { text: string; task: RewriteTask; prompt?: string; engine?: EngineChoice }): { text: string; engine: TranslationEngine };
  engines(): { engines: { engine: TranslationEngine; hasSecret: boolean }[] };
};

export type TranslatorProgress = {
  rewrite: { piece: string };
};

export const translatorV1: ServiceDefinition<TranslatorMethods, {}, TranslatorProgress>;
