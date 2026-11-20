import { useCallback, useEffect, useRef, useState } from "react";
import { ISLAND_PAGES_KEY, loadIslandPages, saveIslandPages, type IslandPagesLayout } from "./islandPages.ts";

const followers = new Set<() => void>();

export function useIslandPages() {
  const [layout, setLayout] = useState<IslandPagesLayout>(loadIslandPages);
  const reloadRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    const reload = () => setLayout(loadIslandPages());
    const follow = (event: StorageEvent) => {
      if (event.key === ISLAND_PAGES_KEY || event.key === null) reload();
    };
    reloadRef.current = reload;
    followers.add(reload);
    window.addEventListener("storage", follow);
    return () => {
      followers.delete(reload);
      window.removeEventListener("storage", follow);
    };
  }, []);
  const save = useCallback((next: IslandPagesLayout) => {
    saveIslandPages(next);
    setLayout(next);
    for (const reload of followers) if (reload !== reloadRef.current) reload();
  }, []);
  return { layout, save };
}
