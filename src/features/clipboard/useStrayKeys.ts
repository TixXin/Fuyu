import { useEffect, useRef, type RefObject } from "react";

export type PopupKeyEvent = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "repeat" | "preventDefault">;

const editable = (target: EventTarget | null) =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable);

export function useStrayKeys({ enabled, root, input, active, onKeyDown, onKeyUp }: {
  enabled: boolean;
  root: RefObject<HTMLElement | null>;
  input: RefObject<HTMLInputElement | null>;
  active: boolean;
  onKeyDown: (event: PopupKeyEvent) => void;
  onKeyUp: (event: PopupKeyEvent) => void;
}) {
  const latest = useRef({ active, onKeyDown, onKeyUp });
  latest.current = { active, onKeyDown, onKeyUp };

  useEffect(() => {
    if (!enabled) return;
    const stray = (event: KeyboardEvent) => !editable(event.target) && !(event.target instanceof Node && root.current?.contains(event.target));
    const down = (event: KeyboardEvent) => {
      if (!stray(event) || event.defaultPrevented) return;
      if (latest.current.active) input.current?.focus();
      latest.current.onKeyDown(event);
    };
    const up = (event: KeyboardEvent) => {
      if (stray(event)) latest.current.onKeyUp(event);
    };
    const focus = () => {
      const current = document.activeElement;
      if (!latest.current.active || current === input.current) return;
      if (editable(current)) return;
      input.current?.focus();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("focus", focus);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("focus", focus);
    };
  }, [enabled, root, input]);
}
