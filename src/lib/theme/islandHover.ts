import type { IslandHover } from "../settings/types";

export const ISLAND_HOVERS = ["near", "subtle", "bold", "drop", "touch", "none"] as const satisfies readonly IslandHover[];

export type IslandHoverShape = {
  growX: number;
  growY: number;
  range: number;
  response: number;
};

const SHAPES: Record<Exclude<IslandHover, "none">, IslandHoverShape> = {
  near: { growX: 20, growY: 5, range: 70, response: 0.42 },
  subtle: { growX: 12, growY: 3, range: 70, response: 0.42 },
  bold: { growX: 30, growY: 8, range: 70, response: 0.55 },
  drop: { growX: 6, growY: 6, range: 70, response: 0.42 },
  touch: { growX: 20, growY: 5, range: 0, response: 0.42 },
};

export function islandHoverShape(hover: IslandHover): IslandHoverShape | null {
  return hover === "none" ? null : SHAPES[hover];
}

export type HoverSpring = { value: number; velocity: number };

const MAX_STEP_SECONDS = 1 / 60;

export function advanceHoverSpring(spring: HoverSpring, target: number, seconds: number, response: number) {
  const omega = (2 * Math.PI) / response;
  let left = seconds;
  while (left > 0) {
    const dt = Math.min(left, MAX_STEP_SECONDS);
    spring.velocity += (omega * omega * (target - spring.value) - 2 * omega * spring.velocity) * dt;
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
