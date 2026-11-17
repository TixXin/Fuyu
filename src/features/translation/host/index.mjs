import { translatorV1 } from "@fuyu/plugin-services";
import { createEngineRegistry } from "./engines.mjs";

export const name = "translation";

const PASSED = new Set(["bad-params", "timeout", "peer-gone", "unsupported", "empty-text", "no-secret", "no-address", "engine-failed"]);
const RENAMED = { inactive: "peer-gone", "translation.noKey": "no-secret", "translation.noAddress": "no-address", "translation.empty": "empty-text" };
const CALLER_MISTAKES = /^translation\.(tooLong|direction|provider|url[A-Za-z]*|modelLong|noModel)$/;
const ENGINE_FIELDS = new Set(["engine", "model"]);

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

function translatorError(code, message, data) {
  return Object.assign(new Error(message), { code, ...(data ? { data } : {}) });
}

export function serviceCode(reason) {
  if (typeof reason !== "string") return "failed";
  if (PASSED.has(reason)) return reason;
  if (Object.hasOwn(RENAMED, reason)) return RENAMED[reason];
  if (CALLER_MISTAKES.test(reason)) return "bad-params";
  return reason.includes(".") ? "engine-failed" : "failed";
}

export function fromRust(error) {
  const reason = error?.code;
  const data = { reason: typeof reason === "string" ? reason : "failed" };
  if (isObject(error?.data?.args)) data.args = error.data.args;
  if (typeof error?.data?.detail === "string") data.detail = error.data.detail;
  return translatorError(serviceCode(reason), String(error?.message ?? error), data);
}

function engineOf(method, params) {
  if (!isObject(params)) throw translatorError("bad-params", `translator/v1 ${method} needs an object with the text`);
  const { engine } = params;
  if (engine === undefined || engine === null) return {};
  const extra = isObject(engine) ? Object.keys(engine).filter((key) => !ENGINE_FIELDS.has(key)) : [];
  if (!isObject(engine) || extra.length) throw translatorError("bad-params", `translator/v1 ${method}: engine must be { engine, model }${extra.length ? `, not ${extra.join(", ")}` : ""}`);
  return { provider: engine.engine ?? null, model: engine.model ?? null };
}

const translated = (result) => ({ text: result?.text, engine: result?.engine });

export function apply(ctx) {
  const registry = createEngineRegistry();
  const call = (method, params, options) =>
    ctx.rust.call(`translator.${method}`, params, { timeoutMs: translatorV1.methods[method].timeoutMs, ...options }).catch((error) => {
      throw fromRust(error);
    });

  const provider = ctx.services.provide(translatorV1, {
    translate: async (params) => {
      const engine = engineOf("translate", params);
      const custom = engine.provider ? registry.get(engine.provider) : null;
      if (custom) {
        return custom.translate({ text: params.text, direction: params.direction ?? "auto", model: engine.model ?? null });
      }
      return translated(await call("translate", { text: params.text, direction: params.direction ?? "auto", ...engine }));
    },
    rewrite: async (params, caller) => {
      const engine = engineOf("rewrite", params);
      const custom = engine.provider ? registry.get(engine.provider) : null;
      if (custom) {
        if (!custom.rewrite) {
          throw translatorError("unsupported", `translation engine ${custom.engine} does not support rewrite`);
        }
        return custom.rewrite(
          { text: params.text, task: params.task, prompt: params.prompt ?? null, model: engine.model ?? null },
          caller,
        );
      }
      const onProgress = (data) => {
        if (typeof data?.piece === "string") caller.progress({ piece: data.piece });
      };
      return translated(await call("rewrite", { text: params.text, task: params.task, prompt: params.prompt ?? null, ...engine }, { onProgress }));
    },
    engines: async () => {
      const [result, extra] = await Promise.all([call("engines", null), registry.entries()]);
      const builtins = Array.isArray(result?.engines)
        ? result.engines.map((entry) => ({ engine: entry?.engine, hasSecret: entry?.hasSecret === true }))
        : [];
      return { engines: [...builtins, ...extra] };
    },
  });

  const unsub = registry.subscribe(() => provider.emit("changed", {}));
  ctx.effect(() => unsub, "translator.engines.watch");
  const stopAccessor = ctx.reflect.accessor("translatorEngines", {
    get() {
      const caller = this;
      return Object.freeze({
        register: (spec) => {
          const off = registry.register(spec);
          caller.effect(() => off, `translatorEngines.register(${spec?.engine ?? ""})`);
          return off;
        },
      });
    },
  });
  ctx.effect(() => stopAccessor, "translatorEngines.accessor");
  ctx.provide("translator.engines", Object.freeze({ register: (spec) => registry.register(spec) }));
}
