import { useLayoutEffect, useState, type RefObject } from "react";
import { DEFAULT_POPUP_SLOT_SIZES, sameSlotSizes, type PopupSlotSizes } from "./popupSlots";

function outerHeight(element: HTMLElement | null, fallback: number) {
  if (!element) return fallback;
  const style = getComputedStyle(element);
  const height = element.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
  return height > 0 ? height : fallback;
}

export function usePopupSlotSizes(listRef: RefObject<HTMLElement | null>, shape: readonly unknown[]) {
  const [sizes, setSizes] = useState<PopupSlotSizes>(DEFAULT_POPUP_SLOT_SIZES);
  const [inset, setInset] = useState(2);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const style = getComputedStyle(list);
    const gap = parseFloat(style.rowGap);
    const next = {
      row: outerHeight(list.querySelector<HTMLElement>(".clipboard-popup__item"), sizes.row),
      section: outerHeight(list.querySelector<HTMLElement>(".clipboard-popup__section"), sizes.section),
      divider: outerHeight(list.querySelector<HTMLElement>(".clipboard-popup__divider"), sizes.divider),
      gap: Number.isFinite(gap) ? gap : sizes.gap,
    };
    if (!sameSlotSizes(next, sizes)) setSizes(next);
    const top = parseFloat(style.paddingTop);
    if (Number.isFinite(top) && top !== inset) setInset(top);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listRef, sizes, inset, ...shape]);

  return { sizes, inset };
}
