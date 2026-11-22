import type { DropSpot, GridTarget } from "./gridTarget";
import type { EdgeState } from "./useEdgeFlip";

export type PagingCopy = {
  dropHere: (page: number) => string;
  dropNew: (page: number) => string;
  dropAway: (page: number) => string;
  dropTray: string;
  pushed: (name: string, page: number) => string;
  edgeFlip: (page: number) => string;
  edgeNew: string;
  firstPage: string;
  dwell: string;
  overview: string;
  keys: string;
};

type HintState = {
  spot: DropSpot | null;
  target: GridTarget | null;
  edge: EdgeState;
  page: number;
  overview: boolean;
  pushed: readonly { name: string; page: number }[];
};

export function dragHint(copy: PagingCopy, { spot, target, edge, page, overview, pushed }: HintState): { text: string; warn: string } {
  const warn = pushed.slice(0, 2).map((item) => copy.pushed(item.name, item.page + 1)).join(" · ");
  if (edge.zone !== 0 && !overview) {
    if (!edge.can) return { text: copy.firstPage, warn: "" };
    return { text: edge.fresh ? copy.edgeNew : copy.edgeFlip(page + 1 + edge.zone), warn: "" };
  }
  if (spot?.kind === "tray") return { text: copy.dropTray, warn: "" };
  if (!target) return { text: copy.keys, warn: "" };
  const where = target.page + 1;
  if (overview) return { text: `${target.fresh ? copy.dropNew(where) : copy.dropHere(where)} · ${copy.overview}`, warn };
  if (spot?.kind === "page" || spot?.kind === "new") {
    if (target.page === page) return { text: copy.dropHere(where), warn };
    return { text: target.fresh ? copy.dropNew(where) : `${copy.dropAway(where)} · ${copy.dwell}`, warn };
  }
  return { text: target.fresh ? copy.dropNew(where) : copy.dropHere(where), warn };
}
