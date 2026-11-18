import { useEffect, useState } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval.ts";

export function useElapsedNow(enabled: boolean): number {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      const next = Date.now();
      setNow((current) => (Math.floor(current / 60_000) === Math.floor(next / 60_000) ? current : next));
    };
    refresh();
    return visibilityInterval(refresh, 30_000);
  }, [enabled]);

  return now;
}
