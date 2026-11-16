import type { Context } from "@fuyu/plugin-base";
import type { ServiceErrorCode } from "@fuyu/plugin-services";

export const name: "todos";
export const METHODS: Readonly<{ list: "todos.list"; days: "todos.days"; add: "todos.add"; update: "todos.update"; remove: "todos.remove"; note: "note.get"; setNote: "note.set" }>;
export function paramsOf(params: unknown): Record<string, unknown>;
export function fromRust(error: unknown): Error & { code: ServiceErrorCode | "not-found" | "unavailable"; data: { reason: string } };
export function fromAnswer(method: string, answer: unknown): unknown;
export function apply(ctx: Context): void;
