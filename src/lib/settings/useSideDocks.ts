import { useCallback, useEffect, useRef, useState } from "react";
import { loadSideDocks, saveSideDocks, SIDE_DOCKS_KEY, type SideDocksSettings } from "./sideDocks.ts";

const followers = new Set<() => void>();

export function useSideDocks() {
  const [settings, setSettings] = useState<SideDocksSettings>(loadSideDocks);
  const reloadRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const reload = () => setSettings(loadSideDocks());
    const follow = (event: StorageEvent) => {
      if (event.key === SIDE_DOCKS_KEY || event.key === null) reload();
    };
    reloadRef.current = reload;
    followers.add(reload);
    window.addEventListener("storage", follow);
    return () => {
      followers.delete(reload);
      window.removeEventListener("storage", follow);
    };
  }, []);

  const save = useCallback((next: SideDocksSettings) => {
    const normalized = saveSideDocks(next);
    setSettings(normalized);
    for (const reload of followers) if (reload !== reloadRef.current) reload();
  }, []);

  return { settings, save };
}
