import { useEffect, useRef } from "react";

type Keys = {
  onCancel: () => void;
  onFlip: (direction: -1 | 1) => void;
  onJump: (page: number) => void;
  onOverview: () => void;
};

export function usePagingKeys(active: boolean, keys: Keys) {
  const latest = useRef(keys);
  useEffect(() => {
    latest.current = keys;
  });
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      const { onCancel, onFlip, onJump, onOverview } = latest.current;
      if (event.key === "Escape") onCancel();
      else if (event.key === " ") onOverview();
      else if (event.key === "ArrowLeft" || event.key === "ArrowRight") onFlip(event.key === "ArrowLeft" ? -1 : 1);
      else if (/^[1-9]$/.test(event.key) && !event.ctrlKey && !event.altKey && !event.metaKey) onJump(Number(event.key) - 1);
      else return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active]);
}
