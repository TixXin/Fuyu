import type { Context } from "@fuyu/plugin-base";

export const name: "timer";
export const RECHECK_MS: number;
export function apply(ctx: Context): void;
