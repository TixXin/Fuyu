import { useMemo } from "react";
import { ArrowDown, ArrowLeftRight, ArrowUp, Ellipsis } from "lucide-react";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsSwitch } from "../../../components/settings/SettingsSwitch";
import { useTranslation } from "../../../i18n";
import { islandItemStyleMatches, islandItemStyles, type IslandItemStyleProps } from "../../../features/plugin-kernel/settingsSlots";
import { useSlotEntries } from "../../../features/plugin-kernel/useSlotEntries";
import {
  moveCollapsedItem,
  setCollapsedItemHidden,
  setCollapsedItemShelf,
  setCollapsedItemZone,
  type CollapsedPlacement,
  type CollapsedZone,
} from "../../../lib/settings/collapsedItems";
import { useCollapsedOverflowIds } from "../../../lib/settings/useCollapsedOverflowIds";
import { CollapsedItemRow } from "../island-layout/CollapsedItemRow";
import { CENTER_ITEMS } from "../island-layout/centerItems";
import type { CollapsedLayout } from "../island-layout/useCollapsedLayout";
import "./CollapsedItemsSection.css";

export function CollapsedItemsSection({ layout, openItem, onOpenItem, ...props }: IslandItemStyleProps & {
  layout: CollapsedLayout;
  openItem: string | null;
  onOpenItem: (item: string | null) => void;
}) {
  const text = useTranslation().settings.collapsedItems;
  const { names, listed, placements, saved, save } = layout;
  const noRoom = useCollapsedOverflowIds();
  const styles = useSlotEntries(islandItemStyles, "islandLayout");
  const styled = (item: string) => styles.some((entry) => islandItemStyleMatches(entry.id, item));
  const centers = useMemo(() => CENTER_ITEMS.filter((item) => styles.some((entry) => islandItemStyleMatches(entry.id, item))), [styles]);
  const change = (next: CollapsedPlacement[]) => save(next);
  const opener = (item: string) => (open: boolean) => onOpenItem(open ? item : null);

  const zone = (name: CollapsedZone) => {
    const rows = placements.filter((placement) => placement.zone === name && names.has(placement.id));
    return (
      <div className="collapsed-items__zone" role="group" aria-label={name === "left" ? text.left : text.right}>
        <h4 className="collapsed-items__zone-title">{name === "left" ? text.left : text.right}</h4>
        {rows.length === 0 ? <p className="settings-section__hint">{text.empty}</p> : null}
        <ul className="plugin-pages">
          {rows.map((placement, index) => {
            const label = names.get(placement.id) ?? placement.id;
            return (
              <CollapsedItemRow
                key={placement.id}
                {...props}
                item={placement.id}
                name={label}
                number={index + 1}
                styled={styled(placement.id)}
                open={openItem === placement.id}
                onOpen={opener(placement.id)}
                badge={!placement.hidden && (placement.shelf || noRoom.has(placement.id)) ? (
                  <small data-badge={placement.shelf ? "panel" : "no-room"}>{placement.shelf ? text.inPanel : text.noRoom}</small>
                ) : null}
                actions={
                  <>
                    <button className="collapsed-items__button" type="button" disabled={index === 0} aria-label={text.moveUp(label)} onClick={() => change(moveCollapsedItem(placements, placement.id, -1, listed))}>
                      <ArrowUp size={12} strokeWidth={2.4} />
                    </button>
                    <button className="collapsed-items__button" type="button" disabled={index === rows.length - 1} aria-label={text.moveDown(label)} onClick={() => change(moveCollapsedItem(placements, placement.id, 1, listed))}>
                      <ArrowDown size={12} strokeWidth={2.4} />
                    </button>
                    <button
                      className="collapsed-items__button"
                      type="button"
                      aria-label={name === "left" ? text.toRight(label) : text.toLeft(label)}
                      onClick={() => change(setCollapsedItemZone(placements, placement.id, name === "left" ? "right" : "left"))}
                    >
                      <ArrowLeftRight size={12} strokeWidth={2.4} />
                    </button>
                    <button
                      className="collapsed-items__button"
                      type="button"
                      aria-pressed={placement.shelf === true}
                      aria-label={placement.shelf ? text.fromPanel(label) : text.toPanel(label)}
                      onClick={() => change(setCollapsedItemShelf(placements, placement.id, !placement.shelf))}
                    >
                      <Ellipsis size={12} strokeWidth={2.4} />
                    </button>
                    <SettingsSwitch id={`collapsed-item-${placement.id}`} ariaLabel={text.showItem(label)} checked={!placement.hidden} onChange={(show) => change(setCollapsedItemHidden(placements, placement.id, !show))} />
                  </>
                }
              />
            );
          })}
        </ul>
      </div>
    );
  };

  const centerNames: Record<string, string> = { center: text.item.center, "todos-count": text.item.todoCount };

  return (
    <SettingsGroup title={text.title} footer={text.hint}>
      <div className="collapsed-items">
        {centers.length > 0 ? (
          <div className="collapsed-items__zone" role="group" aria-label={text.center}>
            <h4 className="collapsed-items__zone-title">{text.center}</h4>
            <p className="settings-section__hint">{text.centerHint}</p>
            <ul className="plugin-pages">
              {centers.map((item) => (
                <CollapsedItemRow key={item} {...props} item={item} name={centerNames[item] ?? item} styled open={openItem === item} onOpen={opener(item)} />
              ))}
            </ul>
          </div>
        ) : null}
        {zone("left")}
        {zone("right")}
        <button className="collapsed-items__button collapsed-items__reset" type="button" disabled={saved.length === 0} onClick={() => save([])}>
          {text.reset}
        </button>
      </div>
    </SettingsGroup>
  );
}
