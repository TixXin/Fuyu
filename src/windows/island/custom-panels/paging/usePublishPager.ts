import { useEffect } from "react";
import type { CustomPanel } from "../../../../lib/settings/customPanels";
import { pagerBlocks, publishPager, type PagerHot, type PagerPlacement } from "./pagerStore";
import type { PageNav } from "./usePageNav";

type PagerSource = {
  active: boolean;
  placement: PagerPlacement;
  panel: CustomPanel;
  pageCount: number;
  pageColumns: number;
  rows: number;
  carried: string | null;
  pushed: ReadonlySet<string>;
  nav: PageNav;
  overview: boolean;
  hot: PagerHot | null;
};

export function usePublishPager({ active, placement, panel, pageCount, pageColumns, rows, carried, pushed, nav, overview, hot }: PagerSource) {
  useEffect(() => {
    if (!active) return publishPager(null);
    publishPager({
      pages: pagerBlocks(panel, pageCount, pageColumns, carried, pushed, rows),
      page: nav.page,
      dragging: carried !== null,
      canAdd: true,
      overview,
      hot,
      placement,
      onPick: (page) => nav.goPage(page),
    });
  });
  useEffect(() => () => publishPager(null), []);
}
