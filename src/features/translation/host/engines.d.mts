import type { Direction, RewriteTask, TranslatorEngineInfo, TranslatorEngineLabel } from "@fuyu/plugin-services";

export type CustomTranslationEngineSpec = {
  engine: string;
  label?: TranslatorEngineLabel;
  defaultModel?: string;
  hasSecret?: boolean | (() => boolean | Promise<boolean>);
  translate(params: { text: string; direction: Direction; model: string | null }): Promise<{ text: string } | string> | { text: string } | string;
  rewrite?(
    params: { text: string; task: RewriteTask; prompt: string | null; model: string | null },
    caller: { progress(chunk: { piece: string } | string): void },
  ): Promise<{ text: string } | string> | { text: string } | string;
};

export type RegisteredTranslationEngine = {
  engine: string;
  label?: TranslatorEngineLabel;
  defaultModel?: string;
  hasSecret: boolean | (() => boolean | Promise<boolean>);
  translate(params: { text: string; direction?: Direction; model?: string | null }): Promise<{ text: string; engine: string }>;
  rewrite: ((params: { text: string; task: RewriteTask; prompt?: string | null; model?: string | null }, caller?: { progress?(chunk: { piece: string }): void }) => Promise<{ text: string; engine: string }>) | null;
};

export type TranslationEngineRegistry = {
  register(spec: CustomTranslationEngineSpec): () => void;
  has(engine: unknown): boolean;
  get(engine: unknown): RegisteredTranslationEngine | null;
  ids(): string[];
  entries(): Promise<TranslatorEngineInfo[]>;
  subscribe(listener: () => void): () => void;
};

export function createEngineRegistry(): TranslationEngineRegistry;
export const translationEngines: TranslationEngineRegistry;
export function registerTranslationEngine(spec: CustomTranslationEngineSpec): () => void;
export function subscribeTranslationEngines(listener: () => void): () => void;
