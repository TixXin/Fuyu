import { useCallback, useState } from "react";
import { startPanelEditing } from "./panelEditing";
import type { Held } from "./paging/usePanelDrag";
import { useLongPress, type LongPressStart } from "./useLongPress";

const holdable = (target: Element) => !target.closest("button, a, input, textarea, select, [contenteditable], [role='slider']");

export function useHoldToEdit(panelId: string) {
  const [held, setHeld] = useState<Held | null>(null);
  const hold = useCallback(
    ({ target, ...point }: LongPressStart) => {
      window.getSelection()?.removeAllRanges();
      startPanelEditing(panelId);
      const widget = target.closest<HTMLElement>(".custom-panel__cell[data-widget]")?.dataset.widget;
      if (widget) setHeld({ widget, ...point });
    },
    [panelId],
  );
  const taken = useCallback(() => setHeld(null), []);
  const onPointerDown = useLongPress(hold, holdable);
  return { held, taken, onPointerDown };
}
