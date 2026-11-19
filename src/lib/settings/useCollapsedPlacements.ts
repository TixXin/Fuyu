import { useCallback, useEffect, useRef, useState } from "react";
import { COLLAPSED_ITEMS_KEY, loadCollapsedPlacements, saveCollapsedPlacements, type CollapsedPlacement } from "./collapsedItems.ts";

const followers = new Set<() => void>();

export function useCollapsedPlacements() {
  const [placements, setPlacements] = useState<CollapsedPlacement[]>(loadCollapsedPlacements);
  const reloadRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    const reload = () => setPlacements(loadCollapsedPlacements());
    const follow = (event: StorageEvent) => {
      if (event.key === COLLAPSED_ITEMS_KEY || event.key === null) reload();
    };
    reloadRef.current = reload;
    followers.add(reload);
    window.addEventListener("storage", follow);
    return () => {
      followers.delete(reload);
      window.removeEventListener("storage", follow);
    };
  }, []);
  const save = useCallback((next: CollapsedPlacement[]) => {
    saveCollapsedPlacements(next);
    setPlacements(next);
    for (const reload of followers) if (reload !== reloadRef.current) reload();
  }, []);
  return { placements, save };
}
