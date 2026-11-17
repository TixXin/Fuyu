import { Inbox } from "lucide-react";
import type { Translations } from "../../../i18n";
import { defineSlot, type IslandCollapsedMeta, type IslandPageMeta } from "../../plugin-kernel/slots";
import { FileShelfPanel } from "../FileShelfPanel";
import { SHELF_COUNT_HINT, shelfIsland } from "./islandState";
import { islandPage } from "./page.ts";
import { OWNER } from "./owner.ts";

type ShelfPageProps = {
  settings: { shelfDoubleClick: string };
};

const pageSlot = defineSlot<ShelfPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function ShelfPage({ settings }: ShelfPageProps) {
  const { shelf, dropping } = shelfIsland.use();
  if (!shelf) return null;
  return <FileShelfPanel shelf={shelf} isDropTarget={dropping} revealOnDoubleClick={settings.shelfDoubleClick === "reveal"} />;
}

pageSlot.add({ ...islandPage, component: ShelfPage }, OWNER);

type CollapsedContext = {
  t: Translations;
  hints: ReadonlySet<string>;
  onOpenPage: (page: "shelf") => void;
};

const collapsedSlot = defineSlot<CollapsedContext, IslandCollapsedMeta<CollapsedContext>>("island.collapsed/v1");

function ShelfItem({ t, onOpenPage }: CollapsedContext) {
  const shelfCount = shelfIsland.use().count;
  return (
    <button className="island-shelf-count" type="button" aria-label={t.island.shelfCount(shelfCount ?? 0)} onClick={() => onOpenPage("shelf")}>
      <Inbox size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      <span>{shelfCount}</span>
    </button>
  );
}

collapsedSlot.add({ id: "shelf", order: 50, shown: ({ hints }) => hints.has(SHELF_COUNT_HINT), component: ShelfItem }, OWNER);
