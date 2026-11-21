import { bounceDamping, ISLAND_BOUNCES } from "./islandBounce.ts";
import type { IslandBounce, IslandHover } from "../settings/types";

export const ISLAND_HOVERS = ["bounce", "near", "subtle", "bold", "drop", "touch", "none"] as const satisfies readonly IslandHover[];

export type IslandHoverShape = {
  growX: number;
  growY: number;
  range: number;
  response: number;
  damping?: number;
};

const SHAPES: Record<Exclude<IslandHover, "none">, IslandHoverShape> = {
  bounce: { growX: 18, growY: 2, range: 0, response: 0.24, damping: 0.54 },
  near: { growX: 20, growY: 5, range: 70, response: 0.42 },
  subtle: { growX: 12, growY: 3, range: 70, response: 0.42 },
  bold: { growX: 30, growY: 8, range: 70, response: 0.55 },
  drop: { growX: 6, growY: 6, range: 70, response: 0.42 },
  touch: { growX: 20, growY: 5, range: 0, response: 0.42 },
};

type Shapes = typeof SHAPES;

const withBounce = (bounce: IslandBounce) =>
  Object.fromEntries(
    Object.entries(SHAPES).map(([hover, shape]) => [hover, shape.damping === undefined ? shape : { ...shape, damping: bounceDamping(shape.damping, bounce) }]),
  ) as Shapes;

const BOUNCED = Object.fromEntries(ISLAND_BOUNCES.map((bounce) => [bounce, bounce === "regular" ? SHAPES : withBounce(bounce)])) as Record<IslandBounce, Shapes>;

export function islandHoverShape(hover: IslandHover, bounce: IslandBounce = "regular"): IslandHoverShape | null {
  return hover === "none" ? null : BOUNCED[bounce][hover];
}

export type HoverSpring = { value: number; velocity: number };

const MAX_STEP_SECONDS = 1 / 60;

export function advanceHoverSpring(spring: HoverSpring, target: number, seconds: number, response: number, damping = 1) {
  const omega = (2 * Math.PI) / response;
  let left = seconds;
  while (left > 0) {
    const dt = Math.min(left, MAX_STEP_SECONDS);
    spring.velocity += (omega * omega * (target - spring.value) - 2 * damping * omega * spring.velocity) * dt;
    spring.value += spring.velocity * dt;
    left -= dt;
  }
}

export function hoverSettled(spring: HoverSpring, target: number) {
  return Math.abs(spring.value - target) < 0.001 && Math.abs(spring.velocity) < 0.01;
}

export function hoverNearness(distance: number, range: number) {
  if (range <= 0) return distance <= 0 ? 1 : 0;
  const near = Math.max(0, Math.min(1, 1 - distance / range));
  return near * near * (3 - 2 * near);
}
