import type { ReactNode } from "react";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { summarySlot } from "./slots/line";

type IslandSummaryProps = {
  item: string | null;
  enabled: boolean;
  bodyOnly?: boolean;
  children: ReactNode;
};

export function IslandSummary({ item, enabled, bodyOnly = false, children }: IslandSummaryProps) {
  if (!item) {
    return (
      <span className="island__summary" role="status" aria-live="polite" aria-atomic="true" data-direction="restore">
        <span className="island__summary-layer">
          <span className="island__summary-row">{children}</span>
        </span>
      </span>
    );
  }
  return <SlotView slot={summarySlot} props={{ enabled, bodyOnly, children }} select={(items) => items.filter((entry) => entry.id === item)} />;
}
