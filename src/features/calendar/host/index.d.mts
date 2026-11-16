import type { Context } from "@fuyu/plugin-base";
import type { CalendarEvents, CalendarSource, ServiceErrorCode } from "@fuyu/plugin-services";

export const name: "calendar";
export function fromRust(error: unknown): Error & { code: ServiceErrorCode; data: { reason: string; args?: Record<string, unknown>; detail?: string } };
export function serviceEvents(snapshot: unknown): CalendarEvents;
export function serviceSources(list: unknown): { sources: CalendarSource[] };
export function refreshOf(params: unknown): boolean;
export function apply(ctx: Context): void;
