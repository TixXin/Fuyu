import type { Context } from "@fuyu/plugin-base";
import type { TranslatorErrorCode, ServiceErrorCode } from "@fuyu/plugin-services";

export const name: "translation";
export function serviceCode(reason: unknown): TranslatorErrorCode | ServiceErrorCode;
export function fromRust(error: unknown): Error & { code: TranslatorErrorCode | ServiceErrorCode; data: { reason: string; args?: Record<string, unknown>; detail?: string } };
export function apply(ctx: Context): void;
