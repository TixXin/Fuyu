import { clipboardV1 } from "@fuyu/plugin-services";

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
  ctx.services.provide(clipboardV1, {
    history: async (params) =>
      serviceTexts(
        await ctx.rust.call("clipboard.history", { limit: limitOf(params) ?? null }).catch((error) => {
          throw fromRust(error);
        }),
      ),
  });
}
