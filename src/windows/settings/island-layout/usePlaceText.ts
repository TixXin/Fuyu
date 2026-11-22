import { useMemo } from "react";
import { useTranslation } from "../../../i18n";
import { useCollapsedOverflowIds } from "../../../lib/settings/useCollapsedOverflowIds";
import { CENTER_ITEMS } from "./centerItems";
import { firstListedMatch, itemPlace } from "./itemPlace";
import { useCollapsedLayout } from "./useCollapsedLayout";

export function usePlaceText(item: string): string {
  const text = useTranslation().settings.collapsedItems.place;
  const { listed, placements } = useCollapsedLayout();
  const away = useCollapsedOverflowIds();
  return useMemo(() => {
    if (item === "center") return text.center;
    if (CENTER_ITEMS.includes(item)) return text.text;
    const target = firstListedMatch(listed, item);
    if (!target) return text.absent;
    const place = itemPlace(placements, new Set(listed), target, away);
    return place.kind === "left" || place.kind === "right" ? text[place.kind](place.position) : text[place.kind];
  }, [item, listed, placements, away, text]);
}
