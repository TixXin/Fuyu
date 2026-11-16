import { todosV1 } from "@fuyu/plugin-services";
import { windowServices } from "../plugin-kernel/services";
import type { LocalApiResponse } from "./api";
import type { LocalApiHandlers } from "./dispatch";

const TODO_METHODS = {
  "todos.list": "list",
  "todos.days": "days",
  "todos.add": "add",
  "todos.update": "update",
  "todos.remove": "remove",
  "note.get": "note",
  "note.set": "setNote",
} as const;

const STATUS: Record<string, number> = { "bad-params": 400, "not-found": 404, "not-ready": 503, "peer-gone": 503, unavailable: 503, timeout: 504 };

type Failure = { code?: unknown; message?: unknown; data?: { status?: unknown; error?: unknown } };

export function failedAnswer(error: unknown): LocalApiResponse {
  const failure = (typeof error === "object" && error !== null ? error : {}) as Failure;
  const status = typeof failure.data?.status === "number" ? failure.data.status : STATUS[String(failure.code)] ?? 500;
  const text = typeof failure.data?.error === "string" ? failure.data.error : String(failure.message ?? error);
  return { ok: false, status, error: text };
}

export function todoHandlers(): LocalApiHandlers {
  const todos = windowServices.get(todosV1) as unknown as Record<string, (params: unknown) => Promise<unknown>>;
  return Object.fromEntries(
    Object.entries(TODO_METHODS).map(([method, name]) => [
      method,
      (params: unknown) => todos[name](params ?? {}).then((data): LocalApiResponse => ({ ok: true, data }), failedAnswer),
    ]),
  );
}
