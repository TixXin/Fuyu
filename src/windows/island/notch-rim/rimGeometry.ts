export type RimBox = { width: number; height: number; fillet: number; corner: number; k: number };

export type RimGeometry = {
  boxWidth: number;
  mid: number;
  height: number;
  rim: string;
  rimLeft: string;
  rimRight: string;
  fill: string;
  length: number;
};

const n = (value: number) => String(Math.round(value * 100) / 100);
const at = (x: number, y: number) => `${n(x)} ${n(y)}`;

export function rimGeometry({ width, height, fillet, corner, k }: RimBox): RimGeometry {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  const f = Math.max(0, Math.min(fillet, h));
  const r = Math.max(0, Math.min(corner, w / 2, h - f));
  const kr = k * r;
  const boxWidth = w + 2 * f;
  const mid = boxWidth / 2;
  const left = f;
  const right = w + f;
  const leftDown = `M0 0 A${n(f)} ${n(f)} 0 0 1 ${at(left, f)} L${at(left, h - r)} C${at(left, h - r + kr)} ${at(left + r - kr, h)} ${at(left + r, h)}`;
  const rightDown = `M${n(boxWidth)} 0 A${n(f)} ${n(f)} 0 0 0 ${at(right, f)} L${at(right, h - r)} C${at(right, h - r + kr)} ${at(right - r + kr, h)} ${at(right - r, h)}`;
  const rim = `${leftDown} L${at(right - r, h)} C${at(right - r + kr, h)} ${at(right, h - r + kr)} ${at(right, h - r)} L${at(right, f)} A${n(f)} ${n(f)} 0 0 1 ${at(boxWidth, 0)}`;
  const length = 2 * (h - r - f) + Math.PI * f + Math.max(0, w - 2 * r) + Math.PI * r;
  return {
    boxWidth,
    mid,
    height: h,
    rim,
    rimLeft: `${leftDown} L${at(mid, h)}`,
    rimRight: `${rightDown} L${at(mid, h)}`,
    fill: `${rim} Z`,
    length,
  };
}

export function sameRimBox(a: RimBox | null, b: RimBox | null) {
  if (a === null || b === null) return a === b;
  return Math.abs(a.width - b.width) < 0.25
    && Math.abs(a.height - b.height) < 0.25
    && Math.abs(a.fillet - b.fillet) < 0.25
    && Math.abs(a.corner - b.corner) < 0.25
    && a.k === b.k;
}
