export const RING_PAD = 28;
export const NOTCH_BOTTOM_RADIUS = 8;
export const NOTCH_EAR = 4;

export type RingGeometry = {
  width: number;
  height: number;
  notchLeft: number;
  notchWidth: number;
  notchHeight: number;
  mid: number;
  bottom: number;
  ring: string;
  left: string;
  right: string;
  body: string;
  ticks: string;
  length: number;
};

const round = (value: number) => Math.round(value * 100) / 100;

function uPath(x: number, n: number, h: number, gap: number) {
  const r = Math.min(NOTCH_BOTTOM_RADIUS, n / 2, h / 2);
  const e = NOTCH_EAR;
  const l = round(x - gap);
  const rx = round(x + n + gap);
  const b = round(h + gap);
  const rr = round(r + gap);
  const start = `M${round(l - e)} 0 A${e} ${e} 0 0 1 ${l} ${e} L${l} ${round(h - r)} A${rr} ${rr} 0 0 0 ${round(x + r)} ${b}`;
  return {
    ring: `${start} L${round(x + n - r)} ${b} A${rr} ${rr} 0 0 0 ${rx} ${round(h - r)} L${rx} ${e} A${e} ${e} 0 0 1 ${round(rx + e)} 0`,
    left: `${start} L${round(x + n / 2)} ${b}`,
    right: `M${round(rx + e)} 0 A${e} ${e} 0 0 0 ${rx} ${e} L${rx} ${round(h - r)} A${rr} ${rr} 0 0 1 ${round(x + n - r)} ${b} L${round(x + n / 2)} ${b}`,
    length: 2 * (h - r) + (n - 2 * r) + Math.PI * rr,
  };
}

export function ringGeometry(notchWidth: number, notchHeight: number, gap: number, tickOffset = 2.5): RingGeometry | null {
  if (!(notchWidth > 0) || !(notchHeight > 0)) return null;
  const x = RING_PAD;
  const n = notchWidth;
  const h = notchHeight;
  const r = Math.min(NOTCH_BOTTOM_RADIUS, n / 2, h / 2);
  const e = NOTCH_EAR;
  const outer = uPath(x, n, h, gap);
  const ticks = uPath(x, n, h, gap + tickOffset).ring;
  const body = `M${round(x - e)} 0 A${e} ${e} 0 0 1 ${x} ${e} L${x} ${round(h - r)} A${r} ${r} 0 0 0 ${round(x + r)} ${h} L${round(x + n - r)} ${h} A${r} ${r} 0 0 0 ${round(x + n)} ${round(h - r)} L${round(x + n)} ${e} A${e} ${e} 0 0 1 ${round(x + n + e)} 0 Z`;
  return {
    width: round(n + 2 * x),
    height: round(h + x),
    notchLeft: x,
    notchWidth: n,
    notchHeight: h,
    mid: round(x + n / 2),
    bottom: round(h + gap),
    ring: outer.ring,
    left: outer.left,
    right: outer.right,
    body,
    ticks,
    length: outer.length,
  };
}
