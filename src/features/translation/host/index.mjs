import { translatorV1 } from "@fuyu/plugin-services";

export const name = "translation";

const PASSED = new Set(["bad-params", "timeout", "peer-gone"]);
const RENAMED = { inactive: "peer-gone", "translation.noKey": "no-secret", "translation.empty": "empty-text" };
const CALLER_MISTAKES = /^translation\.(tooLong|direction|provider|url[A-Za-z]*|modelLong|noModel)$/;

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
  if (!isObject(engine)) throw translatorError("bad-params", `translator/v1 ${method}: engine must be { engine, baseUrl, model }`);
  return { provider: engine.engine ?? null, baseUrl: engine.baseUrl ?? null, model: engine.model ?? null };
}

const translated = (result) => ({ text: result?.text, engine: result?.engine });

export function apply(ctx) {
  const call = (method, params, options) =>
    ctx.rust.call(`translator.${method}`, params, { timeoutMs: translatorV1.methods[method].timeoutMs, ...options }).catch((error) => {
      throw fromRust(error);
    });

  ctx.services.provide(translatorV1, {
    translate: async (params) => {
      const engine = engineOf("translate", params);
      return translated(await call("translate", { text: params.text, direction: params.direction, ...engine }));
    },
    rewrite: async (params, caller) => {
      const engine = engineOf("rewrite", params);
      const onProgress = (data) => {
        if (typeof data?.piece === "string") caller.progress({ piece: data.piece });
      };
      return translated(await call("rewrite", { text: params.text, task: params.task, prompt: params.prompt ?? null, ...engine }, { onProgress }));
    },
    engines: async () => {
      const result = await call("engines", null);
      const engines = Array.isArray(result?.engines) ? result.engines : [];
      return { engines: engines.map((entry) => ({ engine: entry?.engine, hasSecret: entry?.hasSecret === true })) };
    },
  });
}
