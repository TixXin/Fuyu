import { SlotView } from "../../../features/plugin-kernel/SlotView";
import { islandItemStyleMatches, islandItemStyles, type IslandItemStyleProps } from "../../../features/plugin-kernel/settingsSlots";

export function ItemStylePanel({ item, name, open, onToggle, ...props }: IslandItemStyleProps & {
  item: string;
  name: string;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  return (
    <details className="collapsed-items__style" data-style-for={item} open={open} onToggle={(event) => event.currentTarget.open !== open && onToggle(event.currentTarget.open)}>
      <summary hidden>{name}</summary>
      <div className="settings-group__card collapsed-items__style-card">
        <SlotView slot={islandItemStyles} group="islandLayout" props={props} select={(entries) => entries.filter((entry) => islandItemStyleMatches(entry.id, item))} />
      </div>
    </details>
  );
}
