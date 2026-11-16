import type { Context } from "@fuyu/plugin-base";
import type { NowPlaying, ServiceErrorCode } from "@fuyu/plugin-services";

export const name: "music";
export function fromRust(error: unknown): Error & { code: ServiceErrorCode; data: { reason: string; args?: Record<string, unknown>; detail?: string } };
export function serviceNowPlaying(state: unknown): NowPlaying;
export function positionOf(params: unknown): number;
export function apply(ctx: Context): void;
