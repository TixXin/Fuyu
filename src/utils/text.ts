const WIDE_CHARACTER_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa960, 0xa97f],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f300, 0x1f9ff],
  [0x20000, 0x3fffd],
];

function isWideCharacter(codePoint: number) {
  return WIDE_CHARACTER_RANGES.some(
    ([start, end]) => codePoint >= start && codePoint <= end,
  );
}

const COLLAPSED_WIDE_UNITS = 1;
const COLLAPSED_NARROW_UNITS = 0.55;
const COLLAPSED_WHITESPACE_UNITS = 0.35;

export function getCollapsedTextUnits(text: string) {
  let total = 0;

  for (const character of text.trim()) {
    if (/\s/.test(character)) {
      total += COLLAPSED_WHITESPACE_UNITS;
      continue;
    }

    const codePoint = character.codePointAt(0) ?? 0;
    total += isWideCharacter(codePoint)
      ? COLLAPSED_WIDE_UNITS
      : COLLAPSED_NARROW_UNITS;
  }

  return total;
}
