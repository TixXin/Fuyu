export type ResizeEdge = "l" | "r" | "b";

const EDGE = 10;
const CORNER_GAP = 26;
const GRAB_ZONE = 40;
const GRAB_GAP = 56;
const KNOB_ZONE = 70;
const CAP_ZONE = 44;

export type Zone = { near: string[]; edge: ResizeEdge | null };

export function zoneAt(x: number, y: number, width: number, height: number, expanded: boolean, flipped: boolean): Zone {
  const inside = x >= -4 && x <= width + 4 && y >= -4 && y <= height + 4;
  if (!inside) return { near: [], edge: null };
  if (!expanded) {
    const near = [x < CAP_ZONE ? "cap-l" : "", x > width - CAP_ZONE ? "cap-r" : ""].filter(Boolean);
    return { near, edge: x < EDGE ? "l" : x > width - EDGE ? "r" : null };
  }
  const free = flipped ? y : height - y;
  const center = Math.abs(x - width / 2);
  const near = [
    free < GRAB_ZONE && center < Math.max(60, width / 2 - KNOB_ZONE) ? "grab" : "",
    free < KNOB_ZONE && x < KNOB_ZONE ? "knob-l" : "",
    free < KNOB_ZONE && x > width - KNOB_ZONE ? "knob-r" : "",
  ].filter(Boolean);
  let edge: ResizeEdge | null = null;
  if (free > CORNER_GAP && x < EDGE) edge = "l";
  else if (free > CORNER_GAP && x > width - EDGE) edge = "r";
  else if (free < EDGE && x > CORNER_GAP && x < width - CORNER_GAP && center > GRAB_GAP) edge = "b";
  return { near, edge };
}

