import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { disabledBuiltinIds, subscribeBuiltinPlugins } from "./builtinSwitches.ts";
import {
  createIslandContributions,
  lineBelow,
  selectContributed,
  type IslandContributed,
  type IslandContribution,
  type IslandLineContribution,
} from "./islandContributions.ts";

export const islandContributions = createIslandContributions();

const actions = new Map<string, (payload?: unknown) => void>();

if (typeof window !== "undefined") {
  subscribeBuiltinPlugins((plugins) => islandContributions.setDisabledOwners(disabledBuiltinIds(plugins)));
}

export function useIslandContributions(owner: string, id: string, list: readonly IslandContribution[]) {
  const key = JSON.stringify(list);
  const latest = useRef(list);
  latest.current = list;
  useLayoutEffect(() => {
    islandContributions.set(owner, id, latest.current);
  }, [owner, id, key]);
  useLayoutEffect(() => () => islandContributions.remove(owner, id), [owner, id]);
}

export function useSettleIslandContributions() {
  useLayoutEffect(() => islandContributions.settle(), []);
}

export function useIslandContributed(): IslandContributed;
export function useIslandContributed<T>(
  selector: (state: IslandContributed) => T,
  isEqual?: (a: T, b: T) => boolean,
): T;
export function useIslandContributed<T = IslandContributed>(
  selector?: (state: IslandContributed) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const cache = useRef<{ state: IslandContributed; value: T } | null>(null);
  const getSnapshot = () => {
    const next = selectContributed(islandContributions.snapshot(), cache.current, selector, isEqual);
    cache.current = next;
    return next.value;
  };
  return useSyncExternalStore(islandContributions.subscribe, getSnapshot, getSnapshot);
}

export function useLineBelow(priority: number): IslandLineContribution | null {
  const lines = useIslandContributed((state) => state.lines);
  return useMemo(() => lineBelow(lines, priority), [lines, priority]);
}

export function useIslandAction(id: string, run: ((payload?: unknown) => void) | null) {
  const latest = useRef(run);
  latest.current = run;
  const present = run !== null;
  useLayoutEffect(() => {
    if (!present) return;
    const call = (payload?: unknown) => latest.current?.(payload);
    actions.set(id, call);
    return () => {
      if (actions.get(id) === call) actions.delete(id);
    };
  }, [id, present]);
}

export function runIslandAction(id: string, payload?: unknown): boolean {
  const action = actions.get(id);
  if (!action) return false;
  action(payload);
  return true;
}
