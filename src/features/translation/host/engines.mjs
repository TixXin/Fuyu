const BUILTIN_ENGINES = new Set(["deepseek", "volcengine", "dashscope", "moonshot", "siliconflow", "openai", "custom"]);
const ENGINE_ID = /^[a-z][a-z0-9._-]{0,62}$/;

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function engineError(code, message, data) {
  return Object.assign(new Error(message), { code, ...(data ? { data } : {}) });
}

function normalizeLabel(label) {
  if (label === undefined) return undefined;
  if (!isObject(label) || typeof label["zh-CN"] !== "string" || !label["zh-CN"].trim() || typeof label.en !== "string" || !label.en.trim()) {
    throw engineError("bad-params", 'a translation engine label must be { "zh-CN", en } with non-empty text');
  }
  return { "zh-CN": label["zh-CN"].trim(), en: label.en.trim() };
}

function normalizeResult(engine, result) {
  const text = typeof result === "string" ? result : isObject(result) && typeof result.text === "string" ? result.text : null;
  if (text === null) throw engineError("bad-result", `translation engine ${engine} must return { text } or a string`);
  return { text, engine };
}

export function createEngineRegistry() {
  const registered = new Map();
  const listeners = new Set();

  function notify() {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {}
    }
  }

  return {
    register(spec) {
      if (!isObject(spec) || typeof spec.engine !== "string" || !ENGINE_ID.test(spec.engine)) {
        throw engineError("bad-params", "a translation engine needs an id matching /^[a-z][a-z0-9._-]{0,62}$/");
      }
      const { engine } = spec;
      if (BUILTIN_ENGINES.has(engine) || registered.has(engine)) {
        throw engineError("conflict", `translation engine ${engine} is already registered`, { engine });
      }
      if (typeof spec.translate !== "function") {
        throw engineError("bad-params", `translation engine ${engine} must provide a translate function`);
      }
      if (spec.rewrite !== undefined && typeof spec.rewrite !== "function") {
        throw engineError("bad-params", `translation engine ${engine}: rewrite must be a function when given`);
      }
      const label = normalizeLabel(spec.label);
      const defaultModel = typeof spec.defaultModel === "string" && spec.defaultModel.trim() ? spec.defaultModel.trim() : undefined;
      const hasSecret = spec.hasSecret === undefined ? true : spec.hasSecret;
      const entry = {
        engine,
        label,
        defaultModel,
        hasSecret,
        translate: async (params) => {
          const text = typeof params?.text === "string" ? params.text.trim() : "";
          if (!text) throw engineError("empty-text", "translator/v1 translate needs non-empty text", { reason: "translation.empty" });
          const model = typeof params?.model === "string" && params.model.trim() ? params.model.trim() : defaultModel ?? null;
          const answer = await spec.translate({ text, direction: params?.direction ?? "auto", model });
          return normalizeResult(engine, answer);
        },
        rewrite: spec.rewrite
          ? async (params, caller) => {
              const text = typeof params?.text === "string" ? params.text.trim() : "";
              if (!text) throw engineError("empty-text", "translator/v1 rewrite needs non-empty text", { reason: "translation.empty" });
              const model = typeof params?.model === "string" && params.model.trim() ? params.model.trim() : defaultModel ?? null;
              const progress = (chunk) => {
                const piece = typeof chunk === "string" ? chunk : isObject(chunk) && typeof chunk.piece === "string" ? chunk.piece : null;
                if (piece !== null) caller?.progress?.({ piece });
              };
              const answer = await spec.rewrite({ text, task: params?.task ?? "polish", prompt: params?.prompt ?? null, model }, { progress });
              return normalizeResult(engine, answer);
            }
          : null,
      };
      registered.set(engine, entry);
      notify();
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        if (registered.get(engine) === entry) {
          registered.delete(engine);
          notify();
        }
      };
    },

    has(engine) {
      return typeof engine === "string" && registered.has(engine);
    },

    get(engine) {
      return typeof engine === "string" ? registered.get(engine) ?? null : null;
    },

    ids() {
      return [...registered.keys()];
    },

    async entries() {
      const out = [];
      for (const entry of registered.values()) {
        const secret = typeof entry.hasSecret === "function" ? Boolean(await entry.hasSecret()) : entry.hasSecret !== false;
        out.push({
          engine: entry.engine,
          hasSecret: secret,
          ...(entry.label ? { label: entry.label } : {}),
          ...(entry.defaultModel ? { defaultModel: entry.defaultModel } : {}),
        });
      }
      return out;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const translationEngines = createEngineRegistry();
export const registerTranslationEngine = (spec) => translationEngines.register(spec);
export const subscribeTranslationEngines = (listener) => translationEngines.subscribe(listener);
