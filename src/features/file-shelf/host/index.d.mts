import type { Context } from "@fuyu/plugin-base";
import type { FileShelfSnapshot, ServiceErrorCode } from "@fuyu/plugin-services";

export const name: "file-shelf";
export const MAX_PATHS: 20;
export function fromRust(error: unknown): Error & { code: ServiceErrorCode; data: { reason: string; args?: Record<string, unknown>; detail?: string } };
export function pathsOf(params: unknown): string[];
export function serviceItems(snapshot: unknown): FileShelfSnapshot;
export function apply(ctx: Context): void;
