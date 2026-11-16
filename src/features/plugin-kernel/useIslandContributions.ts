import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { disabledBuiltinIds, subscribeBuiltinPlugins } from "./builtinSwitches.ts";
import { createIslandContributions, lineBelow, type IslandContributed, type IslandContribution, type IslandLineContribution } from "./islandContributions.ts";

export const islandContributions = createIslandContributions();

const actions = new Map<string, () => void>();

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

export function useIslandContributed(): IslandContributed {
  return useSyncExternalStore(islandContributions.subscribe, islandContributions.snapshot, islandContributions.snapshot);
}

export function useLineBelow(priority: number): IslandLineContribution | null {
  const { lines } = useIslandContributed();
  return useMemo(() => lineBelow(lines, priority), [lines, priority]);
}

export function useIslandAction(id: string, run: (() => void) | null) {
  const latest = useRef(run);
  latest.current = run;
  const present = run !== null;
  useLayoutEffect(() => {
    if (!present) return;
    const call = () => latest.current?.();
    actions.set(id, call);
    return () => {
      if (actions.get(id) === call) actions.delete(id);
    };
  }, [id, present]);
}

export function runIslandAction(id: string): boolean {
  const action = actions.get(id);
  if (!action) return false;
  action();
  return true;
}
