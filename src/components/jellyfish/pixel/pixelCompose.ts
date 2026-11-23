import { effectSprite, PIXEL_EFFECTS } from "./pixelEffects.ts";
import type { PixelGrid, PixelToneKey } from "./pixelGrids.ts";
import type { PixelPose } from "./pixelPoses.ts";
import type { PixelPaint, PixelTones, Rgb } from "./pixelTones.ts";

export type PixelBuffer = { width: number; height: number; originX: number; originY: number; data: Uint8ClampedArray };

const DARKER: Record<"hi" | "base" | "sh" | "sh2", "base" | "sh" | "sh2"> = { hi: "base", base: "sh", sh: "sh2", sh2: "sh2" };
const NEON_FILL_ALPHA = 41;
const NEON_HALO_ALPHA = 77;
const SPEED_ALPHA = 140;
const PRESS_ALPHA = 191;

function moved(grid: PixelGrid, value: number): number {
  return grid.halfSteps ? Math.sign(value) * Math.ceil(Math.abs(value) / 2) : value * grid.step;
}

export function composePixelJellyfish(grid: PixelGrid, paint: PixelPaint, pose: PixelPose, tones: PixelTones): PixelBuffer {
  const width = grid.width + grid.pad.left + grid.pad.right;
  const height = grid.height + grid.pad.top + grid.pad.bottom;
  const part = new Uint8Array(width * height);
  const shade = new Array<PixelToneKey>(width * height);
  const data = new Uint8ClampedArray(width * height * 4);
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  const bodyAt = (x: number, y: number) => (inside(x, y) ? part[y * width + x] : 0);
  const mark = (x: number, y: number, kind: 1 | 2, key: PixelToneKey) => {
    if (!inside(x, y)) return;
    part[y * width + x] = kind;
    shade[y * width + x] = key;
  };
  const set = (x: number, y: number, color: Rgb, alpha = 255) => {
    if (!inside(x, y)) return;
    const i = (y * width + x) * 4;
    data[i] = color[0];
    data[i + 1] = color[1];
    data[i + 2] = color[2];
    data[i + 3] = alpha;
  };
  const clear = (x: number, y: number) => {
    if (inside(x, y)) data[(y * width + x) * 4 + 3] = 0;
  };

  const bodyX = grid.pad.left + moved(grid, pose.dx);
  const bodyY = grid.pad.top + moved(grid, pose.dy);
  grid.lobeX.forEach((lobeX, index) => {
    const top = bodyY + grid.lobeTop + moved(grid, pose.lobes[index] ?? 0);
    grid.lobe.forEach((row, r) => {
      [...row].forEach((cell, x) => {
        if (cell === "#") mark(bodyX + lobeX + x, top + r, 2, grid.tone(2, lobeX + x, r));
      });
    });
  });
  const rows = grid.head.flatMap((_, index) => (!grid.cut.includes(index) || pose.squash === 0 ? [index] : pose.squash > 0 ? [] : [index, index]));
  const headTop = bodyY + grid.head.length - rows.length;
  rows.forEach((row, n) => {
    const shift = pose.lean * grid.lean(row);
    [...grid.head[row]].forEach((cell, x) => {
      if (cell === "#") mark(bodyX + x + shift, headTop + n, 1, grid.tone(1, x, row));
    });
  });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const kind = part[y * width + x];
      if (!kind) {
        if (paint !== "neon") continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy += 1) for (let dx = -1; dx <= 1 && !near; dx += 1) near = bodyAt(x + dx, y + dy) !== 0;
        if (near) set(x, y, tones.base, NEON_HALO_ALPHA);
        continue;
      }
      const edge = !bodyAt(x - 1, y) || !bodyAt(x + 1, y) || !bodyAt(x, y - 1) || !bodyAt(x, y + 1);
      const raw = shade[y * width + x];
      const key = raw === "di" ? ((x + y) % 2 ? "sh" : "base") : raw === "di2" ? ((x + y) % 2 ? "sh2" : "sh") : raw;
      if (paint === "mono") set(x, y, tones.base);
      else if (paint === "neon") set(x, y, tones.base, edge ? 255 : NEON_FILL_ALPHA);
      else if (paint === "sticker") set(x, y, edge ? tones.outline : tones[key]);
      else if (paint === "fine") set(x, y, edge ? (tones.rim ?? tones[DARKER[key]]) : tones[key]);
      else set(x, y, edge && tones.rim ? tones.rim : tones[key]);
    }
  }

  const face = (x: number, y: number, color: Rgb | null) => {
    const fx = bodyX + x;
    const fy = bodyY + y;
    if (!bodyAt(fx, fy)) return;
    if (color) set(fx, fy, color);
    else clear(fx, fy);
  };
  const ink = paint === "mono" ? null : paint === "neon" ? tones.base : tones.ink;
  const detail = paint !== "mono" && paint !== "neon";
  if (paint !== "mono" && pose.eyes !== "angry") {
    grid.cheeks.forEach(([x, y]) => {
      face(x, y, tones.cheek);
      face(grid.width - 1 - x, y, tones.cheek);
    });
  }
  const lookX = pose.eyeDx * grid.step;
  const lookY = pose.eyeDy * grid.step;
  [false, true].forEach((right) => {
    const anchor = right ? grid.width - 1 - grid.eye[0] : grid.eye[0];
    grid.eyes[pose.eyes].forEach(([dx, dy]) => face(anchor + (right ? -dx : dx) + lookX, grid.eye[1] + dy + lookY, ink));
  });
  if (pose.mouth !== "none") grid.mouth[pose.mouth].forEach(([x, y, tongue]) => face(x, y, tongue && detail ? tones.tongue : ink));

  const originX = grid.pad.left;
  const originY = grid.pad.top;
  for (const effect of pose.effects) {
    if (effect.name === "speed") {
      (grid.speed[effect.frame] ?? []).forEach(([x, y, length]) => {
        for (let i = 0; i < length; i += 1) for (let j = 0; j < grid.step; j += 1) set(originX + x + i, originY + y + j, tones.base, SPEED_ALPHA);
      });
      continue;
    }
    if (effect.name === "press") {
      grid.press.sprite.forEach((row, r) => {
        [...row].forEach((cell, x) => {
          if (cell !== "#") return;
          set(originX + grid.press.x + x, originY + grid.press.y + r, tones.base, PRESS_ALPHA);
          set(originX + grid.width - 1 - grid.press.x - x, originY + grid.press.y + r, tones.base, PRESS_ALPHA);
        });
      });
      continue;
    }
    const { sprite, box } = effectSprite(effect.name, grid.effects, effect.level);
    const [slotX, slotBottom] = grid.slots[effect.slot];
    const left = originX + slotX + Math.floor((box[0].length - sprite[0].length) / 2);
    const top = originY + slotBottom - box.length + 1 + Math.floor((box.length - sprite.length) / 2);
    const color = paint === "mono" ? tones.base : PIXEL_EFFECTS[effect.name].color;
    sprite.forEach((row, r) => {
      [...row].forEach((cell, x) => {
        if (cell === "#") set(left + x, top + r, color);
      });
    });
  }
  return { width, height, originX, originY, data };
}
