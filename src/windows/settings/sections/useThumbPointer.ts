import { useState, type FocusEvent, type PointerEvent } from "react";

function thumbOf(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLElement>("[data-thumb]")?.dataset.thumb ?? null : null;
}

export function useThumbPointer() {
  const [pointed, setPointed] = useState<string | null>(null);
  const handlers = {
    onPointerOver: (event: PointerEvent<HTMLElement>) => setPointed(thumbOf(event.target)),
    onPointerLeave: () => setPointed(null),
    onFocus: (event: FocusEvent<HTMLElement>) => setPointed(thumbOf(event.target)),
    onBlur: () => setPointed(null),
  };
  return { pointed, handlers };
}
