import { useEffect, useState } from "react";
import { getScreenshotTargets, listenScreenshotTargets } from "../../features/screenshot/api";
import type { Target } from "../../features/screenshot/targets";
import { getErrorMessage } from "../../utils/error";

export function useTargets(id: number | null): readonly Target[] {
  const [targets, setTargets] = useState<{ id: number | null; list: Target[] }>({ id: null, list: [] });

  useEffect(() => {
    if (id === null) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    const load = () => {
      getScreenshotTargets()
        .then((list) => { if (!cancelled) setTargets({ id, list }); })
        .catch((error: unknown) => console.error("Failed to read the screenshot targets", getErrorMessage(error)));
    };
    void listenScreenshotTargets((event) => { if (event.payload === id) load(); })
      .then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)));
    load();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [id]);

  return targets.id === id ? targets.list : [];
}
