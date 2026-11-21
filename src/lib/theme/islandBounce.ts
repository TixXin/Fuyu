import type { IslandBounce } from "../settings/types";

export const ISLAND_BOUNCES = ["subtle", "regular", "bouncy"] as const satisfies readonly IslandBounce[];

const DAMPING_FACTOR: Record<IslandBounce, number> = { subtle: 1.25, regular: 1, bouncy: 0.8 };

export function bounceDamping(damping: number, bounce: IslandBounce, floor = 0): number {
  return Math.min(1, Math.max(floor, damping * DAMPING_FACTOR[bounce]));
}
