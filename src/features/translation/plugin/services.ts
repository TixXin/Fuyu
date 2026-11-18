import { translatorV1, type EngineChoice, type TranslationEngine } from "@fuyu/plugin-services";
import { windowServices } from "../../plugin-kernel/services";
import { isNativeError } from "../../../i18n/nativeError";
import { hasTranslationSecret, rewriteText, translateText, type TranslationService } from "../api";
import { isBuiltinTranslationProvider, isLoopbackCustomBaseUrl, TRANSLATION_PROVIDERS, translationEngines, type BuiltinTranslationProvider } from "../providers";
import { loadSettings } from "../storage";
import { fromRust } from "../host/index.mjs";
import { OWNER } from "./owner.ts";

function chosenEngine(engine: EngineChoice | undefined): { id: TranslationEngine; model: string | null } {
  if (engine) return { id: engine.engine, model: engine.model?.trim() || null };
  const settings = loadSettings();
  return { id: settings.provider, model: settings.models[settings.provider]?.trim() || null };
}

function builtinService(id: BuiltinTranslationProvider, model: string | null): TranslationService {
  const settings = loadSettings();
  return {
    provider: id,
    baseUrl: id === "custom" ? settings.customBaseUrl.trim() || null : null,
    model,
  };
}

function serviceError(error: unknown) {
  if (!isNativeError(error)) return fromRust({ code: undefined, message: error instanceof Error ? error.message : String(error) });
  return fromRust({ code: error.code, message: error.message, data: { args: error.args, detail: error.detail } });
}

function failed(error: unknown): never {
  throw serviceError(error);
}

const provider = windowServices.provide(translatorV1, {
  translate: async ({ text, direction, engine }) => {
    const chosen = chosenEngine(engine);
    const custom = translationEngines.get(chosen.id);
    const resolvedDirection = direction ?? loadSettings().direction;
    if (custom) {
      return custom.translate({ text, direction: resolvedDirection, model: chosen.model });
    }
    if (!isBuiltinTranslationProvider(chosen.id)) {
      throw Object.assign(new Error(`unknown translation engine ${chosen.id}`), { code: "bad-params" });
    }
    const service = builtinService(chosen.id, chosen.model);
    return { text: await translateText(text, resolvedDirection, service).catch(failed), engine: service.provider };
  },
  rewrite: async ({ text, task, prompt, engine }, caller) => {
    const chosen = chosenEngine(engine);
    const custom = translationEngines.get(chosen.id);
    if (custom) {
      if (!custom.rewrite) {
        throw Object.assign(new Error(`translation engine ${custom.engine} does not support rewrite`), { code: "unsupported" });
      }
      return custom.rewrite({ text, task, prompt: prompt ?? null, model: chosen.model }, caller);
    }
    if (!isBuiltinTranslationProvider(chosen.id)) {
      throw Object.assign(new Error(`unknown translation engine ${chosen.id}`), { code: "bad-params" });
    }
    const service = builtinService(chosen.id, chosen.model);
    const onChunk = (piece: string) => caller.progress({ piece });
    return { text: await rewriteText(text, task, service, { prompt, onChunk }).catch(failed), engine: service.provider };
  },
  engines: async () => {
    const customAddress = loadSettings().customBaseUrl;
    const [builtins, extra] = await Promise.all([
      Promise.all(TRANSLATION_PROVIDERS.map(async (engine) => {
        const stored = await hasTranslationSecret(engine).catch(failed);
        return { engine, hasSecret: stored || (engine === "custom" && isLoopbackCustomBaseUrl(customAddress)) };
      })),
      translationEngines.entries(),
    ]);
    return { engines: [...builtins, ...extra] };
  },
}, { owner: OWNER });

translationEngines.subscribe(() => {
  provider.emit("changed", {});
});
