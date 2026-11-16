import { Inbox } from "lucide-react";
import type { Translations } from "../../../i18n";
import { defineSlot, type IslandCollapsedMeta, type IslandPageMeta } from "../../plugin-kernel/slots";
import { FileShelfPanel } from "../FileShelfPanel";
import type { useFileShelf } from "../useFileShelf";
import { islandPage } from "./page.ts";

type ShelfPageProps = {
  fileShelf: ReturnType<typeof useFileShelf>;
  isShelfDropping: boolean;
  settings: { shelfDoubleClick: string };
};

const pageSlot = defineSlot<ShelfPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function ShelfPage({ fileShelf, isShelfDropping, settings }: ShelfPageProps) {
  return <FileShelfPanel shelf={fileShelf} isDropTarget={isShelfDropping} revealOnDoubleClick={settings.shelfDoubleClick === "reveal"} />;
}

pageSlot.add({ ...islandPage, component: ShelfPage });

type CollapsedContext = {
  t: Translations;
  shelfCount: number | null;
  onOpenPage: (page: "shelf") => void;
};

const collapsedSlot = defineSlot<CollapsedContext, IslandCollapsedMeta<CollapsedContext>>("island.collapsed/v1");

function ShelfItem({ t, shelfCount, onOpenPage }: CollapsedContext) {
  return (
    <button className="island-shelf-count" type="button" aria-label={t.island.shelfCount(shelfCount ?? 0)} onClick={() => onOpenPage("shelf")}>
      <Inbox size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      <span>{shelfCount}</span>
    </button>
  );
}

collapsedSlot.add({ id: "shelf", order: 50, shown: ({ shelfCount }) => shelfCount !== null && shelfCount > 0, component: ShelfItem });
