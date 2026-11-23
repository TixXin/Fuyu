export type PixelPoint = readonly [number, number];
export type PixelGridKey = "S" | "M" | "L";
export type PixelEyes = "open" | "blink" | "closed" | "happy" | "angry" | "dot" | "squeeze";
export type PixelMouth = "none" | "small" | "open" | "flat";
export type PixelToneKey = "hi" | "base" | "sh" | "sh2" | "di" | "di2";
export type PixelEffectSlot = "a" | "b";
export type PixelEffectSize = "s" | "m" | "l";
export type PixelMouthPoint = readonly [number, number, boolean?];

export type PixelGrid = {
  key: PixelGridKey;
  width: number;
  height: number;
  step: number;
  halfSteps: boolean;
  pad: { left: number; right: number; top: number; bottom: number };
  head: readonly string[];
  cut: readonly number[];
  lean: (row: number) => number;
  lobeX: readonly number[];
  lobe: readonly string[];
  lobeTop: number;
  tone: (part: 1 | 2, x: number, row: number) => PixelToneKey;
  eye: PixelPoint;
  eyes: Record<PixelEyes, readonly PixelPoint[]>;
  mouth: Record<Exclude<PixelMouth, "none">, readonly PixelMouthPoint[]>;
  cheeks: readonly PixelPoint[];
  slots: Record<PixelEffectSlot, PixelPoint>;
  speed: readonly (readonly (readonly [number, number, number])[])[];
  effects: PixelEffectSize;
  press: { sprite: readonly string[]; x: number; y: number };
};

function points(rows: readonly string[]): PixelPoint[] {
  return rows.flatMap((row, y) => [...row].flatMap((cell, x) => (cell === "#" ? [[x, y] as const] : [])));
}

function dome(width: number, rows: number, widest: number, corner: number): string[] {
  const half = width / 2;
  return Array.from({ length: rows }, (_, row) => {
    const y = row + 0.5;
    let reach = half;
    if (y <= widest) reach = half * Math.pow(1 - Math.pow((widest - y) / widest, 2.2), 1 / 2.2);
    else if (y > rows - corner) reach = half - (corner - Math.sqrt(corner * corner - Math.pow(y - (rows - corner), 2)));
    const filled = Math.min(width, Math.floor(reach) * 2 + 1);
    const side = (width - filled) / 2;
    return ".".repeat(side) + "#".repeat(filled) + ".".repeat(side);
  });
}

const SMALL_EYES: Record<PixelEyes, readonly PixelPoint[]> = {
  open: [[0, 0], [0, 1]],
  blink: [[0, 1]],
  closed: [[-1, 1], [0, 1], [1, 1]],
  happy: [[-1, 1], [0, 0], [1, 1]],
  angry: [[-1, -1], [0, 0], [0, 1]],
  dot: [[0, 0]],
  squeeze: [[-1, 0], [0, 1], [-1, 2]],
};

const FINE_OPEN = points([".#.", "###", "###", "###", ".#."]);

function fineTone(part: 1 | 2, x: number, row: number): PixelToneKey {
  if (part === 2) return row >= 9 ? "sh2" : "sh";
  const dx = x + 0.5 - 9.5;
  const dy = row + 0.5 - 4.6;
  const along = dx * 0.9 - dy * 0.44;
  const across = dx * 0.44 + dy * 0.9;
  if ((along / 3.6) ** 2 + (across / 1.3) ** 2 <= 1) return "hi";
  if (row >= 17) return "sh";
  if (row >= 15) return "di";
  return "base";
}

export const PIXEL_GRIDS: Record<PixelGridKey, PixelGrid> = {
  S: {
    key: "S",
    width: 11,
    height: 8,
    step: 1,
    halfSteps: true,
    pad: { left: 4, right: 8, top: 5, bottom: 2 },
    head: ["..#######..", ".#########.", "###########", "###########", "###########", ".#########."],
    cut: [1],
    lean: (row) => (row === 0 ? 1 : 0),
    lobeX: [2, 4, 6, 8],
    lobe: ["#", "#", "#"],
    lobeTop: 5,
    tone: (part) => (part === 2 ? "sh" : "base"),
    eye: [3, 2],
    eyes: SMALL_EYES,
    mouth: { small: [[4, 4]], open: [[5, 4]], flat: [[4, 4], [5, 4], [6, 4]] },
    cheeks: [[1, 4]],
    slots: { a: [11, 1], b: [14, 3] },
    speed: [[[12, 2, 2], [13, 5, 2]], [[13, 2, 2], [12, 5, 2]]],
    effects: "s",
    press: { sprite: ["#.", ".#", "#."], x: -3, y: 2 },
  },
  M: {
    key: "M",
    width: 17,
    height: 12,
    step: 1,
    halfSteps: false,
    pad: { left: 4, right: 9, top: 6, bottom: 2 },
    head: [".....#######.....", "...###########...", "..#############..", ".###############.", ".###############.", "#################", "#################", "#################", "#################", ".###############."],
    cut: [3],
    lean: (row) => (row <= 2 ? 1 : 0),
    lobeX: [1, 5, 9, 13],
    lobe: ["###", "###", "###", ".#."],
    lobeTop: 8,
    tone: (part, x, row) => (part === 2 ? "sh" : (row === 1 && (x === 4 || x === 5)) || (row === 2 && x === 3) ? "hi" : "base"),
    eye: [5, 5],
    eyes: SMALL_EYES,
    mouth: { small: [[7, 7]], open: [[7, 7], [8, 7], [9, 7], [8, 8, true]], flat: [[7, 7], [8, 7], [9, 7]] },
    cheeks: [[2, 7], [3, 7]],
    slots: { a: [15, 1], b: [19, 4] },
    speed: [[[19, 4, 3], [20, 7, 2], [19, 10, 3]], [[20, 4, 3], [19, 7, 3], [21, 10, 2]]],
    effects: "m",
    press: { sprite: ["#.", ".#", "#."], x: -3, y: 4 },
  },
  L: {
    key: "L",
    width: 33,
    height: 24,
    step: 2,
    halfSteps: false,
    pad: { left: 8, right: 18, top: 12, bottom: 4 },
    head: dome(33, 18, 13.5, 4),
    cut: [5, 7],
    lean: (row) => (row <= 3 ? 2 : row <= 8 ? 1 : 0),
    lobeX: [4, 10, 16, 22],
    lobe: ["#######", "#######", "#######", "#######", "#######", "#######", "#######", ".#####.", ".#####.", "..###.."],
    lobeTop: 14,
    tone: fineTone,
    eye: [10, 9],
    eyes: {
      open: FINE_OPEN,
      blink: [[0, 3], [1, 3], [2, 3]],
      closed: [[-1, 3], [0, 3], [1, 3], [2, 3], [3, 3]],
      happy: [[-1, 3], [-1, 2], [0, 1], [1, 1], [2, 1], [3, 2], [3, 3]],
      angry: [...FINE_OPEN, [-2, -3], [-1, -3], [0, -2], [1, -2], [2, -1], [3, -1]],
      dot: [[0, 2], [1, 2], [0, 3], [1, 3]],
      squeeze: [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]],
    },
    mouth: {
      small: [[13, 15], [14, 15], [15, 15]],
      open: [[14, 14], [15, 14], [16, 14], [17, 14], [18, 14], [15, 15], [16, 15, true], [17, 15]],
      flat: [[15, 15], [16, 15], [17, 15]],
    },
    cheeks: [[5, 14], [6, 14], [7, 14], [5, 15], [6, 15], [7, 15]],
    slots: { a: [30, 3], b: [38, 9] },
    speed: [[[38, 8, 5], [40, 14, 4], [38, 20, 5]], [[40, 8, 5], [38, 14, 5], [41, 20, 4]]],
    effects: "l",
    press: { sprite: ["#..", ".#.", "..#", ".#.", "#.."], x: -6, y: 8 },
  },
};
