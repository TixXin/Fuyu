import { useEffect, useState } from "react";
import { SESSION_FILTERS_STORAGE_KEY, loadSessionFilters, normalizeSessionFilters, saveSessionFilters, type SessionFilter } from "./sessionFilters";

export function useSessionFilters() {
  const [filters, setFilters] = useState<SessionFilter[]>(loadSessionFilters);

  useEffect(() => { saveSessionFilters(filters); }, [filters]);

  useEffect(() => {
    const syncFromOtherWindow = (event: StorageEvent) => {
      if (event.key === SESSION_FILTERS_STORAGE_KEY) setFilters(loadSessionFilters());
    };
    window.addEventListener("storage", syncFromOtherWindow);
    return () => window.removeEventListener("storage", syncFromOtherWindow);
  }, []);

  const update = (next: SessionFilter[]) => setFilters(normalizeSessionFilters(next));
  return [filters, update] as const;
}
