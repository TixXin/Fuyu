const SNUG = 1.12;
const LOOSE = 1.25;
const SMALLEST = 0.74;

function cellFor(target: number, rows: number, over: number): number {
  const exact = target / rows;
  const rounded = Math.round(exact);
  const cell = rounded * rows > target * over ? Math.floor(exact) : rounded;
  return cell >= 1 && cell * rows >= target * SMALLEST ? cell : 0;
}

export function fitPixelGrid(boxHeight: number, pixelRatio: number, rowOptions: readonly number[]): { index: number; cell: number } {
  const target = boxHeight * pixelRatio;
  const own = rowOptions[0];
  for (const over of [SNUG, LOOSE]) {
    const cell = cellFor(target, own, over);
    if (cell) return { index: 0, cell };
  }
  for (let index = 1; index < rowOptions.length; index += 1) {
    const cell = cellFor(target, rowOptions[index], LOOSE);
    if (cell) return { index, cell };
  }
  return { index: 0, cell: Math.max(1, Math.floor(target / own)) };
}
