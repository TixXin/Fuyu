import { SlotView } from "../../../features/plugin-kernel/SlotView";
import { islandItemStyleMatches, islandItemStyles, type IslandItemStyleProps } from "../../../features/plugin-kernel/settingsSlots";
import { useTranslation } from "../../../i18n";

export function ItemStyleTabs({ items, current, onPick, ...props }: IslandItemStyleProps & {
  items: readonly { id: string; name: string; place: string }[];
  current: string | null;
  onPick: (id: string) => void;
}) {
  const text = useTranslation().settings.collapsedItems;
  if (items.length === 0) return null;
  const shown = items.find((item) => item.id === current) ?? items[0];
  return (
    <section className="lane-styles" aria-label={text.lanes.styles}>
      <div className="lane-styles__tabs" role="tablist">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            data-item={item.id}
            data-search-tab
            aria-selected={item.id === shown.id}
            aria-label={text.styleOf(item.name)}
            onClick={() => onPick(item.id)}
          >
            {item.name}
            <span className="lane-styles__where">{item.place}</span>
          </button>
        ))}
      </div>
      <div className="lane-styles__body" role="tabpanel" data-style-for={shown.id}>
        <SlotView slot={islandItemStyles} group="islandLayout" props={props} select={(entries) => entries.filter((entry) => islandItemStyleMatches(entry.id, shown.id))} />
      </div>
    </section>
  );
}
