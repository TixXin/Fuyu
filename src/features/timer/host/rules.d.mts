import type { TimersErrorCode } from "@fuyu/plugin-services";
import type { Timer } from "../timers.ts";

export type TimersRuleCode = TimersErrorCode | "bad-params";
export type TimersRuleError = Error & { code: TimersRuleCode };

export function timersError(code: TimersRuleCode, message: string): TimersRuleError;
export function idOf(params: unknown, method: string): string;
export function startTimer(timers: readonly Timer[], params: unknown, now: number, id: string, owner?: string): { timers: Timer[]; timer: Timer };
export function changeTimer(timers: readonly Timer[], method: "pause" | "resume" | "extend", params: unknown, now: number): { timers: readonly Timer[]; timer: Timer };
export function ringDue(timers: readonly Timer[], now: number): { timers: readonly Timer[]; due: Timer[] };
export function dismissRung(timers: readonly Timer[]): Timer[];
export function adoptTimers(timers: readonly Timer[], params: unknown, now: number, owner?: string): { timers: readonly Timer[]; due: Timer[]; added: number };
