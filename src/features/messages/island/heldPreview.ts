import type { MessagePreview } from "../messagePreview";

export type HeldPreview = { preview: MessagePreview; key: string; remaining: number; deadline: number | null };

export function previewKey(preview: MessagePreview) {
  return JSON.stringify([preview.source, preview.receivedAt, preview.title, preview.body]);
}

export function remainingAtHover(droppedAt: number, hoverStartedAt: number, shownSince: number) {
  return Math.max(0, droppedAt - Math.max(hoverStartedAt, shownSince));
}

export function heldOnHover(held: HeldPreview | null, inside: boolean, now: number): HeldPreview | null {
  if (!held) return held;
  if (inside) return held.deadline === null ? held : { ...held, remaining: Math.max(0, held.deadline - now), deadline: null };
  return held.deadline === null ? { ...held, deadline: now + held.remaining } : held;
}
