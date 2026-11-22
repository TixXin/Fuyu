export type DropKind = "page" | "new" | "all" | "tray" | "sheet";
export type DropHit = { kind: DropKind; index: number; rect: DOMRect };

const PAD_PX = 3;
const KINDS = new Set<string>(["page", "new", "all", "tray", "sheet"]);

export function dropHitAt(x: number, y: number): DropHit | null {
  const found = document.querySelectorAll<HTMLElement>("[data-panel-drop]");
  for (let at = found.length - 1; at >= 0; at -= 1) {
    const element = found[at];
    const kind = element.dataset.panelDrop ?? "";
    if (!KINDS.has(kind)) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || x < rect.left - PAD_PX || x > rect.right + PAD_PX || y < rect.top - PAD_PX || y > rect.bottom + PAD_PX) continue;
    return { kind: kind as DropKind, index: Number(element.dataset.index ?? 0), rect };
  }
  return null;
}

export function sheetPoint(hit: DropHit, x: number, y: number, viewWidth: number, boardHeight: number, pageStepPx: number) {
  const left = Math.min(Math.max(0, (x - hit.rect.left) / hit.rect.width), 0.999) * viewWidth;
  const top = Math.min(Math.max(0, (y - hit.rect.top) / hit.rect.height), 0.999) * boardHeight;
  return { x: hit.index * pageStepPx + left, y: top };
}

export const dwellKey = (hit: DropHit | null) => (hit && (hit.kind === "page" || hit.kind === "all") ? `${hit.kind}:${hit.index}` : null);
