import { clipboardV1 } from "@fuyu/plugin-services";
import { createClipboardActionRegistry } from "./actions.mjs";

export const name = "clipboard";

export const MAX_LIMIT = 50;

const PASSED = new Set(["bad-params", "timeout", "peer-gone"]);

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

function clipboardError(code, message, data) {
  return Object.assign(new Error(message), { code, ...(data ? { data } : {}) });
}

export function fromRust(error) {
  const reason = typeof error?.code === "string" ? error.code : "failed";
  const code = PASSED.has(reason) ? reason : reason === "inactive" ? "peer-gone" : "failed";
  const data = { reason };
  if (isObject(error?.data?.args)) data.args = error.data.args;
  if (typeof error?.data?.detail === "string") data.detail = error.data.detail;
  return clipboardError(code, String(error?.message ?? error), data);
}

export function limitOf(params) {
  if (params === undefined || params === null) return undefined;
  const limit = isObject(params) && Object.keys(params).every((key) => key === "limit") ? params.limit : null;
  if (limit === undefined) return undefined;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw clipboardError("bad-params", `clipboard/v1 history takes { limit?: number } with a whole number from 1 to ${MAX_LIMIT}`);
  }
  return limit;
}

export function copyParamsOf(params) {
  if (!isObject(params) || !Object.keys(params).every((key) => key === "text") || typeof params.text !== "string" || params.text.trim() === "") {
    throw clipboardError("bad-params", "clipboard/v1 copyText takes { text: string } with non-empty text");
  }
  return { text: params.text };
}

export function pasteParamsOf(params) {
  if (
    !isObject(params) ||
    !Object.keys(params).every((key) => key === "text" || key === "enter") ||
    typeof params.text !== "string" ||
    params.text === "" ||
    (params.enter !== undefined && typeof params.enter !== "boolean")
  ) {
    throw clipboardError("bad-params", "clipboard/v1 pasteText takes { text: string, enter?: boolean } with non-empty text");
  }
  return { text: params.text, enter: params.enter === true };
}

function serviceText(item) {
  return {
    id: String(item.id),
    text: typeof item.text === "string" ? item.text : "",
    truncated: item.truncated === true,
    copiedAt: typeof item.copiedAt === "number" && Number.isFinite(item.copiedAt) ? item.copiedAt : 0,
    favorite: item.favorite === true,
  };
}

export function serviceTexts(answer) {
  const items = Array.isArray(answer?.items) ? answer.items : [];
  return { items: items.filter((item) => isObject(item) && typeof item.id === "string").map(serviceText) };
}

export function apply(ctx) {
  const actions = createClipboardActionRegistry();
  const stopAccessor = ctx.reflect.accessor("clipboardActions", {
    get() {
      const caller = this;
      return Object.freeze({
        register: (spec) => {
          const off = actions.register(spec);
          caller.effect(() => off, `clipboardActions.register(${spec?.id ?? ""})`);
          return off;
        },
        list: () => actions.list(),
        forItem: (item) => actions.forItem(item),
        run: (id, context) => actions.run(id, context),
      });
    },
  });
  ctx.effect(() => stopAccessor, "clipboardActions.accessor");
  ctx.provide(
    "clipboard.actions",
    Object.freeze({
      register: (spec) => actions.register(spec),
      list: () => actions.list(),
      forItem: (item) => actions.forItem(item),
      run: (id, context) => actions.run(id, context),
    }),
  );

  ctx.services.provide(clipboardV1, {
    history: async (params) =>
      serviceTexts(
        await ctx.rust.call("clipboard.history", { limit: limitOf(params) ?? null }).catch((error) => {
          throw fromRust(error);
        }),
      ),
    copyText: async (params) => {
      const { text } = copyParamsOf(params);
      await ctx.rust.call("clipboard.copyText", { text }).catch((error) => {
        throw fromRust(error);
      });
      return { ok: true };
    },
    pasteText: async (params) => {
      const { text, enter } = pasteParamsOf(params);
      await ctx.rust.call("clipboard.pasteText", { text, enter }).catch((error) => {
        throw fromRust(error);
      });
      return { ok: true };
    },
  });
}
