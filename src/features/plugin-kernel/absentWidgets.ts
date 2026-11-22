import { useEffect, useSyncExternalStore } from "react";
import type { WidgetSizesOf } from "../../lib/settings/customPanels";

let absent: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function setAbsent(id: string, missing: boolean) {
  if (absent.has(id) === missing) return;
  const next = new Set(absent);
  if (missing) next.add(id);
  else next.delete(id);
  absent = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProvideAbsentWidget(id: string, missing: boolean) {
  useEffect(() => {
    setAbsent(id, missing);
    return () => setAbsent(id, false);
  }, [id, missing]);
}

export function useAbsentWidgets(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => absent);
}

export function skipAbsentWidgets(sizesOf: WidgetSizesOf, missing: ReadonlySet<string>): WidgetSizesOf {
  return missing.size === 0 ? sizesOf : (widget) => (missing.has(widget) ? null : sizesOf(widget));
}
