import { useEffect, type KeyboardEvent, type PointerEvent, type RefObject } from "react";

export const stopPointer = (event: PointerEvent) => event.stopPropagation();

export function editorKeys(onEnter: (() => void) | null, onEscape: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      onEscape();
    } else if (onEnter && event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onEnter();
    }
  };
}

export function useOwnWheel(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const stop = (event: WheelEvent) => event.stopPropagation();
    element.addEventListener("wheel", stop, { passive: true });
    return () => element.removeEventListener("wheel", stop);
  }, [ref]);
}
