import { todosV1 } from "@fuyu/plugin-services";

export const name = "todos";

const PASSED = new Set(["bad-params", "not-found", "timeout", "peer-gone", "unavailable"]);
const STATUS_CODES = { 400: "bad-params", 404: "not-found", 503: "not-ready" };

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

function todosError(code, message, data) {
  return Object.assign(new Error(message), { code, ...(data ? { data } : {}) });
}

export function paramsOf(params) {
  return isObject(params) ? params : {};
}

export function fromRust(error) {
  const reason = typeof error?.code === "string" ? error.code : "failed";
  const code = PASSED.has(reason) ? reason : reason === "inactive" ? "peer-gone" : "failed";
  return todosError(code, String(error?.message ?? error), { reason });
}

export function fromAnswer(method, answer) {
  if (answer?.ok === true) return answer.data;
  const status = typeof answer?.status === "number" ? answer.status : 500;
  const error = String(answer?.error ?? "failed");
  return Promise.reject(todosError(STATUS_CODES[status] ?? "failed", `todos/v1 ${method}: ${error}`, { status, error }));
}

export const METHODS = Object.freeze({
  list: "todos.list",
  days: "todos.days",
  add: "todos.add",
  update: "todos.update",
  remove: "todos.remove",
  note: "note.get",
  setNote: "note.set",
});

export function apply(ctx) {
  const call = (method, params) =>
    ctx.rust.call(`todos.${method}`, paramsOf(params)).catch((error) => {
      throw fromRust(error);
    });

  ctx.services.provide(todosV1, {
    list: (params) => call("list", params),
    days: (params) => call("days", params),
    add: (params) => call("add", params),
    update: (params) => call("update", params),
    remove: (params) => call("remove", params),
    note: (params) => call("note", params),
    setNote: (params) => call("setNote", params),
  });
}
