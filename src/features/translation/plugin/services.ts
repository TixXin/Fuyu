import { translatorV1, type EngineChoice, type TranslationEngine } from "@fuyu/plugin-services";
import { windowServices } from "../../plugin-kernel/services";
import { isNativeError } from "../../../i18n/nativeError";
import { hasTranslationSecret, rewriteText, translateText, type TranslationService } from "../api";
import { TRANSLATION_PROVIDERS } from "../providers";
import { loadSettings } from "../storage";
import { fromRust } from "../host/index.mjs";
import { OWNER } from "./owner.ts";

function chosenService(engine: EngineChoice | undefined): TranslationService {
  if (engine) return { provider: engine.engine, baseUrl: null, model: engine.model?.trim() || null };
  const settings = loadSettings();
  return {
    provider: settings.provider,
    baseUrl: settings.provider === "custom" ? settings.customBaseUrl.trim() || null : null,
    model: settings.models[settings.provider]?.trim() || null,
  };
}

function serviceError(error: unknown) {
  if (!isNativeError(error)) return fromRust({ code: undefined, message: error instanceof Error ? error.message : String(error) });
  return fromRust({ code: error.code, message: error.message, data: { args: error.args, detail: error.detail } });
}

function failed(error: unknown): never {
  throw serviceError(error);
}

const used = (service: TranslationService): TranslationEngine => service.provider;

windowServices.provide(translatorV1, {
  translate: async ({ text, direction, engine }) => {
    const service = chosenService(engine);
    return { text: await translateText(text, direction, service).catch(failed), engine: used(service) };
  },
  rewrite: async ({ text, task, prompt, engine }, caller) => {
    const service = chosenService(engine);
    const onChunk = (piece: string) => caller.progress({ piece });
    return { text: await rewriteText(text, task, service, { prompt, onChunk }).catch(failed), engine: used(service) };
  },
  engines: async () => ({
    engines: await Promise.all(TRANSLATION_PROVIDERS.map(async (engine) => ({ engine, hasSecret: await hasTranslationSecret(engine).catch(failed) }))),
  }),
}, { owner: OWNER });
