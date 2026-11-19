import { useCallback, useEffect, useRef, useState } from "react";
import { onPluginBarUsageReport, requestPluginBarUsage } from "../../features/plugin-kernel/api";
import type { BarUsageReport } from "../../features/plugin-kernel/barUsage";
import { useVisibilityInterval } from "../../lib/useVisibilityInterval";

export interface BarUsageView {
  report: BarUsageReport | null;
  stale: boolean;
}

const POLL_MS = 2000;
const GIVE_UP_MS = 1500;
const AFTER_CHANGE_MS = 180;

const same = (a: BarUsageView | undefined, b: BarUsageView) =>
  a !== undefined && a.stale === b.stale && JSON.stringify({ ...a.report, id: 0 }) === JSON.stringify({ ...b.report, id: 0 });

export function usePluginBarUsage(enabled: boolean): { usage: BarUsageView | undefined; refresh: () => void } {
  const [usage, setUsage] = useState<BarUsageView | undefined>(undefined);
  const counter = useRef(0);
  const ask = useCallback(() => {
    if (!enabled) return;
    counter.current += 1;
    void requestPluginBarUsage(counter.current).catch(() => undefined);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    void onPluginBarUsageReport((report) => {
      if (cancelled) return;
      setUsage((current) => {
        const next: BarUsageView = report.collapsed || !current?.report?.collapsed ? { report, stale: false } : { report: current.report, stale: true };
        return same(current, next) ? current : next;
      });
    })
      .then((unlisten) => {
        if (cancelled) return unlisten();
        stop = unlisten;
        ask();
      })
      .catch(() => undefined);
    const giveUp = window.setTimeout(() => setUsage((current) => current ?? { report: null, stale: false }), GIVE_UP_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(giveUp);
      stop?.();
    };
  }, [enabled, ask]);

  useVisibilityInterval(ask, enabled ? POLL_MS : null);

  const refresh = useCallback(() => {
    window.setTimeout(ask, AFTER_CHANGE_MS);
  }, [ask]);

  return { usage: enabled ? usage : undefined, refresh };
}
