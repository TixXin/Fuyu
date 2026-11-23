import type { PixelMood } from "./pixel/pixelPoses.ts";

export type JellyLook = { x: -1 | 0 | 1; y: -1 | 0 | 1 };

export const JELLY_LOOK_REST: JellyLook = { x: 0, y: 0 };
export const JELLY_POKE_MS = 1600;
const NEAR = 0.6;

function side(distance: number, reach: number): -1 | 0 | 1 {
  if (Math.abs(distance) < reach) return 0;
  return distance < 0 ? -1 : 1;
}

export function lookToward(dx: number, dy: number, width: number, height: number): JellyLook {
  return { x: side(dx, width * NEAR), y: side(dy, height * NEAR) };
}

export function pokedMood(mood: PixelMood): PixelMood | null {
  if (mood === "idle") return "done";
  if (mood === "sleep") return "waiting";
  return null;
}

export function dozeHour(hour: number): boolean {
  return hour >= 23 || hour < 6;
}

export function nextDozeChange(now: number): number {
  const at = new Date(now);
  const hour = at.getHours();
  const tomorrow = hour >= 23 ? 1 : 0;
  return new Date(at.getFullYear(), at.getMonth(), at.getDate() + tomorrow, hour >= 6 && hour < 23 ? 23 : 6).getTime();
}
