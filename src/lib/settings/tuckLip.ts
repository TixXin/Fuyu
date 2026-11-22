import { clamp } from "../../utils/number.ts";
import type { TuckStyle } from "./types";

export const TUCK_LIP_HEIGHT_RANGE = { min: 2, max: 14 } as const;
export const TUCK_LIP_WIDTH_RANGE = { min: 80, max: 340, step: 20 } as const;
export const TUCK_PRESET_HEIGHT: Readonly<Record<TuckStyle, number>> = { edge: 10, line: 4, hidden: 0 };
export const DEFAULT_TUCKED_HOVER_DELAY_MS = 150;
export const MIN_TUCKED_HOVER_DELAY_MS = 0;
export const MAX_TUCKED_HOVER_DELAY_MS = 1_000;

export function normalizeTuckLip(value: unknown, { min, max }: { min: number; max: number }): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? clamp(Math.round(value), min, max) : 0;
}

export function normalizeTuckedHoverDelay(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(Math.round(value), MIN_TUCKED_HOVER_DELAY_MS, MAX_TUCKED_HOVER_DELAY_MS)
    : DEFAULT_TUCKED_HOVER_DELAY_MS;
}

export function tuckLipHeight(style: TuckStyle, custom: number): number {
  return style === "hidden" ? 0 : custom > 0 ? custom : TUCK_PRESET_HEIGHT[style];
}
