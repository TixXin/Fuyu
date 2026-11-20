import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "../../../i18n";
import type { IslandItemStyleProps } from "../../../features/plugin-kernel/settingsSlots";
import { ItemStylePanel } from "./ItemStylePanel";

export function CollapsedItemRow({ item, name, number, badge, styled, open, onOpen, actions, ...props }: IslandItemStyleProps & {
  item: string;
  name: string;
  number?: number;
  badge?: ReactNode;
  styled: boolean;
  open: boolean;
  onOpen: (open: boolean) => void;
  actions?: ReactNode;
}) {
  const text = useTranslation().settings.collapsedItems;
  return (
    <li className="collapsed-items__item" data-item={item} data-open={open || undefined}>
      <div className="plugin-pages__row collapsed-items__row">
        <span className="collapsed-items__number" aria-hidden="true">{number ?? "·"}</span>
        <span className="plugin-pages__name">
          <strong>{name}</strong>
          {badge}
        </span>
        {styled ? (
          <button className="collapsed-items__button collapsed-items__expand" type="button" aria-expanded={open} aria-label={text.styleOf(name)} onClick={() => onOpen(!open)}>
            <ChevronDown size={12} strokeWidth={2.4} />
          </button>
        ) : null}
        {actions}
      </div>
      {styled ? <ItemStylePanel item={item} name={name} open={open} onToggle={onOpen} {...props} /> : null}
    </li>
  );
}
