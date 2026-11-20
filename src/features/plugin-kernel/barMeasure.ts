import { loadLocale } from "../../i18n";
import { barItemName, barUsageReport, type BarUsageBox, type BarUsageCandidate, type BarUsagePage, type BarUsageReport } from "./barUsage.ts";
import { pluginNames } from "./pluginNames";
import { localizedTitle } from "./slotTitle";
import { windowSlots } from "./slots";

const BAR = ".island__collapsed";
const COLLAPSED_SLOT = "island.collapsed/v1";
const PAGE_SLOT = "island.page/v1";

type PageCandidate = { id: string; owner: string; external?: boolean; title?: unknown };

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
  const locale = loadLocale();
  const names = pluginNames();
  const nameOf = (candidate: BarUsageCandidate, siblings: number) =>
    barItemName(candidate, siblings, localizedTitle(candidate.label, locale), localizedTitle(names.get(candidate.owner), locale));
  const report = barUsageReport(id, windowSlots("island").items(COLLAPSED_SLOT) as readonly BarUsageCandidate[], shown ? bar.offsetWidth : null, boxOf, nameOf);
  const pages = (windowSlots("island").items(PAGE_SLOT) as readonly PageCandidate[])
    .filter((page) => page.external === true)
    .map((page): BarUsagePage => ({ id: page.id, owner: page.owner, name: localizedTitle(page.title, locale) ?? localizedTitle(names.get(page.owner), locale) ?? page.owner }));
  return { ...report, pages };
}
