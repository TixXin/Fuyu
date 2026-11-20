import { useCallback, useEffect, useRef, useState } from "react";
import { CUSTOM_PANELS_KEY, loadCustomPanels, saveCustomPanels, type CustomPanel } from "./customPanels.ts";

const followers = new Set<() => void>();

export function useCustomPanels() {
  const [panels, setPanels] = useState<CustomPanel[]>(loadCustomPanels);
  const reloadRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    const reload = () => setPanels(loadCustomPanels());
    const follow = (event: StorageEvent) => {
      if (event.key === CUSTOM_PANELS_KEY || event.key === null) reload();
    };
    reloadRef.current = reload;
    followers.add(reload);
    window.addEventListener("storage", follow);
    return () => {
      followers.delete(reload);
      window.removeEventListener("storage", follow);
    };
  }, []);
  const save = useCallback((next: CustomPanel[]) => {
    saveCustomPanels(next);
    setPanels(next);
    for (const reload of followers) if (reload !== reloadRef.current) reload();
  }, []);
  return { panels, save };
}
