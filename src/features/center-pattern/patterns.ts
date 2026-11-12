export const CENTER_PATTERNS = ["eyes", "bird", "orb", "cat", "mark"] as const;
export type CenterPatternId = (typeof CENTER_PATTERNS)[number];

export type PetMood = "idle" | "running" | "waiting" | "failed" | "done";

export const PET_SHEET_COLUMNS = 8;
export const PET_CELL_WIDTH = 192;
export const PET_CELL_HEIGHT = 208;
const PET_SHEET_ROW_COUNTS = [9, 11];

type PetRow = { row: number; frames: number; durationMs: number };

const PET_ROWS: Record<PetMood, PetRow> = {
  idle: { row: 0, frames: 6, durationMs: 1100 },
  running: { row: 7, frames: 6, durationMs: 820 },
  waiting: { row: 6, frames: 6, durationMs: 1010 },
  failed: { row: 5, frames: 8, durationMs: 1220 },
  done: { row: 3, frames: 4, durationMs: 700 },
};

export function petRow(mood: PetMood): PetRow {
  return PET_ROWS[mood] ?? PET_ROWS.idle;
}

export function petSheetRows(width: number, height: number): number | null {
  if (!(width > 0 && height > 0)) return null;
  const cellHeight = (width / PET_SHEET_COLUMNS) * (PET_CELL_HEIGHT / PET_CELL_WIDTH);
  const rows = height / cellHeight;
  return PET_SHEET_ROW_COUNTS.find((count) => Math.abs(rows - count) < 0.02) ?? null;
}

export type PetSpriteLayout = {
  rowShift: number;
  loopShift: number;
  frames: number;
  durationMs: number;
};

export function petSpriteLayout(mood: PetMood, rows: number): PetSpriteLayout {
  const { row, frames, durationMs } = petRow(mood);
  return {
    rowShift: -(row / rows) * 100,
    loopShift: -(frames / PET_SHEET_COLUMNS) * 100,
    frames,
    durationMs,
  };
}

export function gazeOffset(dx: number, dy: number, max: number, reach = 90): { x: number; y: number } {
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance < 0.5) return { x: 0, y: 0 };
  const length = max * Math.min(1, distance / reach);
  return { x: (dx / distance) * length, y: (dy / distance) * length * 0.75 };
}
