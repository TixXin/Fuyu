import type { PageSwitchEffect, PageSwitchIndicator, PageSwitchSpeed } from "../settings/types";
import { MOTION_EASE, MOTION_EASE_IN_OUT, MOTION_EASE_OUT, MOTION_MEDIUM_MS } from "./motionTokens.ts";

export const PAGE_SWITCH_EFFECTS = ["carousel", "fade", "ripple", "wipe", "sheen", "pixel", "none"] as const satisfies readonly PageSwitchEffect[];
export const PAGE_SWITCH_INDICATORS = ["stretch", "slide", "jump"] as const satisfies readonly PageSwitchIndicator[];
export const PAGE_SWITCH_SPEEDS = ["fast", "normal", "slow"] as const satisfies readonly PageSwitchSpeed[];

export type PageSwitchKind = Exclude<PageSwitchEffect, "carousel">;
export type SwitchDirection = -1 | 0 | 1;
export type SwitchAxis = "x" | "y";
export type SwitchPoint = { x: number; y: number };
export type SwitchBox = { width: number; height: number };
export type SwitchFrames = Record<string, string | number>[];
export type SwitchLayer = { frames: SwitchFrames; duration: number; delay: number; easing: string };
export type SwitchOverlay = { kind: "edge" | "sheen"; style: Record<string, string>; layer: SwitchLayer };
export type SwitchRequest = {
  effect: PageSwitchKind;
  direction: SwitchDirection;
  axis: SwitchAxis;
  box: SwitchBox;
  origin: SwitchPoint | null;
  speed: number;
  random: () => number;
};

export const CAROUSEL_EFFECTS: readonly PageSwitchKind[] = ["ripple", "wipe", "sheen", "pixel", "fade"];
const SPEEDS: Record<PageSwitchSpeed, number> = { fast: 0.7, normal: 1, slow: 1.4 };
const RIPPLE_MS = 360;
const WIPE_MS = 340;
const SHEEN_FADE_MS = 260;
const SHEEN_BAND_MS = 520;
const PIXEL_MS = 400;
const PIXEL_COLUMNS = 12;
const PIXEL_ROWS = 8;
const PIXEL_FRAMES = 10;
export const INDICATOR_MS = 280;

export function pageSwitchSpeed(speed: PageSwitchSpeed): number {
  return SPEEDS[speed] ?? 1;
}

export function resolvePageSwitch(effect: PageSwitchEffect, turn: number, reduced: boolean): PageSwitchKind {
  const kind = effect === "carousel" ? CAROUSEL_EFFECTS[((turn % CAROUSEL_EFFECTS.length) + CAROUSEL_EFFECTS.length) % CAROUSEL_EFFECTS.length] : effect;
  return reduced && kind !== "none" ? "fade" : kind;
}

export function resolveIndicator(indicator: PageSwitchIndicator, reduced: boolean): PageSwitchIndicator {
  return reduced ? "jump" : indicator;
}

export function switchOrigin({ direction, axis, box, origin }: Pick<SwitchRequest, "direction" | "axis" | "box" | "origin">): SwitchPoint {
  if (origin) return origin;
  const { width, height } = box;
  if (direction === 0) return { x: width / 2, y: height / 2 };
  const far = direction > 0;
  return axis === "x" ? { x: far ? width : 0, y: height / 2 } : { x: width / 2, y: far ? height : 0 };
}

const SOLID = "linear-gradient(#000, #000)";
const DOT = "radial-gradient(circle closest-side, #000 98%, transparent 100%)";

function mask(image: string, size: string, position: string): Record<string, string> {
  return {
    maskImage: image, maskSize: size, maskPosition: position, maskRepeat: "no-repeat",
    webkitMaskImage: image, webkitMaskSize: size, webkitMaskPosition: position, webkitMaskRepeat: "no-repeat",
  };
}

const xy = (x: number, y: number) => `${Math.round(x)}px ${Math.round(y)}px`;

function wipeFrames({ direction, axis, box }: SwitchRequest): SwitchFrames {
  const { width, height } = box;
  const horizontal = axis === "x";
  const span = horizontal ? width : height;
  const start = direction > 0 ? span : direction < 0 ? 0 : span / 2;
  const at = (offset: number) => (horizontal ? xy(offset, 0) : xy(0, offset));
  const size = (length: number) => (horizontal ? xy(length, height) : xy(width, length));
  return [mask(SOLID, size(0), at(start)), mask(SOLID, size(span), at(0))];
}

function rippleFrames(request: SwitchRequest): SwitchFrames {
  const { x, y } = switchOrigin(request);
  const { width, height } = request.box;
  const radius = Math.ceil(Math.hypot(Math.max(x, width - x), Math.max(y, height - y))) + 1;
  return [mask(DOT, xy(0, 0), xy(x, y)), mask(DOT, xy(radius * 2, radius * 2), xy(x - radius, y - radius))];
}

function pixelFrames(request: SwitchRequest): SwitchFrames {
  const { box, direction, axis, random } = request;
  const cellWidth = Math.ceil(box.width / PIXEL_COLUMNS);
  const cellHeight = Math.ceil(box.height / PIXEL_ROWS);
  const cells: { at: number; position: string }[] = [];
  for (let row = 0; row < PIXEL_ROWS; row += 1) {
    for (let column = 0; column < PIXEL_COLUMNS; column += 1) {
      const line = axis === "x" ? column / PIXEL_COLUMNS : row / PIXEL_ROWS;
      const bias = direction === 0 ? 0 : direction > 0 ? line : 1 - 1 / (axis === "x" ? PIXEL_COLUMNS : PIXEL_ROWS) - line;
      cells.push({ at: bias * 0.6 + random() * 0.4, position: xy(column * cellWidth, row * cellHeight) });
    }
  }
  const cell = xy(cellWidth, cellHeight);
  const frames: SwitchFrames = [];
  for (let step = 0; step < PIXEL_FRAMES; step += 1) {
    const shown = cells.filter((item) => item.at < step / PIXEL_FRAMES);
    const frame = shown.length === 0
      ? mask("linear-gradient(transparent, transparent)", cell, xy(0, 0))
      : mask(shown.map(() => SOLID).join(", "), shown.map(() => cell).join(", "), shown.map((item) => item.position).join(", "));
    frames.push({ ...frame, offset: step / PIXEL_FRAMES });
  }
  frames.push({ ...mask(SOLID, xy(box.width, box.height), xy(0, 0)), offset: 1 });
  return frames;
}

export function pageLayers(request: SwitchRequest): SwitchLayer[] {
  const { effect, speed } = request;
  const ms = (value: number) => Math.round(value * speed);
  if (effect === "fade") return [{ frames: [{ opacity: 0 }, { opacity: 1 }], duration: ms(MOTION_MEDIUM_MS), delay: 0, easing: MOTION_EASE_OUT }];
  if (effect === "ripple") return [{ frames: rippleFrames(request), duration: ms(RIPPLE_MS), delay: 0, easing: MOTION_EASE_IN_OUT }];
  if (effect === "wipe") return [{ frames: wipeFrames(request), duration: ms(WIPE_MS), delay: 0, easing: MOTION_EASE_OUT }];
  if (effect === "sheen") return [{ frames: [{ opacity: 0 }, { opacity: 1 }], duration: ms(SHEEN_FADE_MS), delay: 0, easing: MOTION_EASE_OUT }];
  if (effect === "pixel") return [{ frames: pixelFrames(request), duration: ms(PIXEL_MS), delay: 0, easing: "linear" }];
  return [];
}

export function overlayLayers(request: SwitchRequest): SwitchOverlay[] {
  const { effect, speed, direction, axis, box } = request;
  const ms = (value: number) => Math.round(value * speed);
  if (effect === "wipe") {
    const horizontal = axis === "x";
    const span = horizontal ? box.width : box.height;
    const edges: (1 | -1)[] = direction === 0 ? [-1, 1] : [direction];
    return edges.map((edge) => {
      const start = direction === 0 ? span / 2 : edge > 0 ? span - 2 : 0;
      const end = direction === 0 ? (edge > 0 ? span - 2 : 0) : edge > 0 ? 0 : span - 2;
      const move = (at: number) => (horizontal ? `translateX(${Math.round(at)}px)` : `translateY(${Math.round(at)}px)`);
      return {
        kind: "edge",
        style: horizontal ? { top: `${Math.round(box.height * 0.06)}px`, height: `${Math.round(box.height * 0.88)}px`, width: "2px", left: "0px" } : { left: `${Math.round(box.width * 0.04)}px`, width: `${Math.round(box.width * 0.92)}px`, height: "2px", top: "0px" },
        layer: { frames: [{ transform: move(start), opacity: 0.95 }, { transform: move(end), opacity: 0 }], duration: ms(WIPE_MS), delay: 0, easing: MOTION_EASE_OUT },
      };
    });
  }
  if (effect === "sheen") {
    const band = Math.round(box.width * 0.45);
    const back = direction < 0;
    const from = back ? box.width * 1.1 : -band;
    const to = back ? -band : box.width * 1.1;
    return [{
      kind: "sheen",
      style: { top: `${Math.round(-box.height * 0.1)}px`, height: `${Math.round(box.height * 1.2)}px`, width: `${band}px`, left: "0px" },
      layer: { frames: [{ transform: `translateX(${Math.round(from)}px) skewX(-12deg)` }, { transform: `translateX(${Math.round(to)}px) skewX(-12deg)` }], duration: ms(SHEEN_BAND_MS), delay: 0, easing: MOTION_EASE_IN_OUT },
    }];
  }
  return [];
}

export type IndicatorSpan = { start: number; size: number };

export function indicatorFrames(mode: PageSwitchIndicator, from: IndicatorSpan, to: IndicatorSpan): { frames: IndicatorSpan[]; offsets: number[]; easings: string[] } | null {
  if (mode === "jump" || (from.start === to.start && from.size === to.size)) return null;
  if (mode === "slide") return { frames: [from, to], offsets: [0, 1], easings: [MOTION_EASE] };
  const forward = to.start > from.start;
  const middle = forward
    ? { start: from.start, size: to.start + to.size - from.start }
    : { start: to.start, size: from.start + from.size - to.start };
  return { frames: [from, middle, to], offsets: [0, 0.45, 1], easings: [MOTION_EASE_IN_OUT, MOTION_EASE] };
}

export function indicatorDuration(mode: PageSwitchIndicator, speed: number): number {
  return Math.round(INDICATOR_MS * speed * (mode === "stretch" ? 1.15 : 1));
}

export type PageSwitchMotion = { effect: PageSwitchEffect; speed: PageSwitchSpeed; directional: boolean };
export const FADE_PAGE_SWITCH: PageSwitchMotion = { effect: "fade", speed: "normal", directional: true };

let turns = 0;
export function nextCarouselTurn(): number {
  turns += 1;
  return turns - 1;
}
