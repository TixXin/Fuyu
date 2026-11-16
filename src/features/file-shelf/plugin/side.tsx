import { Inbox } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { defineSlot } from "../../plugin-kernel/slots";
import { shelfIsland } from "./islandState";
import { OWNER } from "./owner";

type SideContext = {
  onOpenPage: (page: "shelf") => void;
};

const sideSlot = defineSlot<SideContext>("island.side/v1");

function ShelfRow({ onOpenPage }: SideContext) {
  const t = useTranslation();
  const count = shelfIsland.use().count ?? 0;
  return (
    <button
      type="button"
      className="island-side-cell"
      aria-label={t.island.shelfCount(count)}
      onClick={(event) => {
        event.stopPropagation();
        onOpenPage("shelf");
      }}
    >
      <Inbox size={16} strokeWidth={1.6} aria-hidden="true" />
      <span className="island-side-cell__num">{count}</span>
    </button>
  );
}

sideSlot.add({ id: "shelf", order: 80, component: ShelfRow }, OWNER);
