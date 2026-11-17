import type { Context } from "@fuyu/plugin-base";
import type { ClipboardTexts, ServiceErrorCode } from "@fuyu/plugin-services";

export const name: "clipboard";
export const MAX_LIMIT: number;
export function fromRust(error: unknown): Error & { code: ServiceErrorCode; data: { reason: string; args?: Record<string, unknown>; detail?: string } };
export function limitOf(params: unknown): number | undefined;
export function copyParamsOf(params: unknown): { text: string };
export function pasteParamsOf(params: unknown): { text: string; enter: boolean };
export function serviceTexts(answer: unknown): ClipboardTexts;
export function apply(ctx: Context): void;
