import { barUsageReport, type BarUsageBox, type BarUsageCandidate, type BarUsageReport } from "./barUsage.ts";
import { windowSlots } from "./slots";

const BAR = ".island__collapsed";
const COLLAPSED_SLOT = "island.collapsed/v1";

export function measureBarUsage(id: number): BarUsageReport {
  const bar = document.querySelector<HTMLElement>(BAR);
  const shown = bar !== null && !bar.inert && bar.getClientRects().length > 0;
  const frame = shown ? bar.getBoundingClientRect() : null;
  const ratio = frame && frame.width > 0 ? bar!.offsetWidth / frame.width : 1;
  const boxOf = (item: string): BarUsageBox | null => {
    const outer = bar?.querySelector<HTMLElement>(`[data-fit-item="${CSS.escape(item)}"]`);
    const inner = outer?.firstElementChild;
    if (!frame || !outer || !(inner instanceof HTMLElement) || inner.getClientRects().length === 0) return null;
    return { left: (outer.getBoundingClientRect().left - frame.left) * ratio, width: outer.clientWidth, wanted: inner.offsetWidth, clipped: outer.hasAttribute("data-clipped") };
  };
  return barUsageReport(id, windowSlots("island").items(COLLAPSED_SLOT) as readonly BarUsageCandidate[], shown ? bar.offsetWidth : null, boxOf);
}
