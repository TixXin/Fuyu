import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { getHoverUsage, type HoverProviderId, type HoverUsage } from "./api";
import type { HoverUsageProvider } from "./usageRing";

const REFRESH_MS = 30_000;

export function useHoverUsages(providers: readonly HoverUsageProvider[]) {
  const [items, setItems] = useState<Partial<Record<HoverProviderId, HoverUsage>>>({});
  const [now, setNow] = useState(() => Date.now());
  const [nonce, setNonce] = useState(0);
  const refreshNext = useRef(false);
  const key = useMemo(() => providers.map((p) => p.id).join(","), [providers]);

  useEffect(() => {
    const ids = key ? (key.split(",") as HoverProviderId[]) : [];
    if (ids.length === 0) {
      setItems({});
      return;
    }
    let cancelled = false;
    const read = (refresh: boolean) => {
      void Promise.all(
        ids.map(async (id) => {
          try {
            return [id, await getHoverUsage(id, refresh)] as const;
          } catch (error: unknown) {
            console.error(`Failed to read ${id} hover usage`, error);
            return [id, undefined] as const;
          }
        }),
      ).then((entries) => {
        if (cancelled) return;
        const next: Partial<Record<HoverProviderId, HoverUsage>> = {};
        for (const [id, value] of entries) {
          if (value) next[id] = value;
        }
        setItems(next);
        setNow(Date.now());
      });
    };
    read(refreshNext.current);
    refreshNext.current = false;
    const stop = visibilityInterval(() => read(false), REFRESH_MS);
    return () => {
      cancelled = true;
      stop();
    };
  }, [key, nonce]);

  const refresh = useCallback(() => {
    refreshNext.current = true;
    setNonce((value) => value + 1);
  }, []);

  return { items, now, refresh };
}
