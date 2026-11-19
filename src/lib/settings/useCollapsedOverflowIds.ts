import { useEffect, useState } from "react";
import { COLLAPSED_OVERFLOW_KEY, loadCollapsedOverflow } from "./collapsedItems.ts";

export function useCollapsedOverflowIds(): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set(loadCollapsedOverflow()));
  useEffect(() => {
    const follow = (event: StorageEvent) => {
      if (event.key === COLLAPSED_OVERFLOW_KEY || event.key === null) setIds(new Set(loadCollapsedOverflow()));
    };
    window.addEventListener("storage", follow);
    return () => window.removeEventListener("storage", follow);
  }, []);
  return ids;
}
