import type { Timer } from "../timers.ts";

export const DATA_FILE: "timers.json";
export const DATA_FORMAT: 1;
export function readTimers(file: URL): { timers: Timer[]; problem?: Error };
export function writeTimers(file: URL, timers: readonly Timer[]): void;
