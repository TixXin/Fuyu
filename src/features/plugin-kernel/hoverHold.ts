export const HOVER_HOLD_RETRY_MS = 1000;
export const MAX_HOVER_HOLD_MS = 30_000;

export type HoldsOpen = (heldSince: number) => boolean;

export function holdsOpen(hovered: boolean, heldSince: number, now: number): boolean {
  return hovered && now - heldSince < MAX_HOVER_HOLD_MS;
}
