import { useLayoutEffect, useSyncExternalStore, type ReactNode } from "react";

export type IslandDecor = {
  center?: ReactNode;
  centerWidth?: number;
  agentIcon?: ReactNode;
  agentIconWidth?: number;
  statusLight?: ReactNode;
  agentCount?: ReactNode;
  sideWidth?: number;
};

const EMPTY: IslandDecor = {};
const parts = new Map<string, IslandDecor>();
const listeners = new Set<() => void>();
let merged: IslandDecor = EMPTY;

export function mergeIslandDecor<T extends IslandDecor>(list: Iterable<T>): T {
  const next = {} as T;
  let sideWidth = 0;
  for (const part of list) {
    Object.assign(next, part);
    sideWidth += part.sideWidth ?? 0;
  }
  delete next.sideWidth;
  if (sideWidth > 0) next.sideWidth = sideWidth;
  return Object.keys(next).length === 0 ? (EMPTY as T) : next;
}

function update() {
  merged = mergeIslandDecor(parts.values());
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const read = () => merged;

export function useIslandDecor(): IslandDecor {
  return useSyncExternalStore(subscribe, read, read);
}

export function useProvideIslandDecor(id: string, decor: IslandDecor) {
  useLayoutEffect(() => {
    if (parts.get(id) === decor) return;
    parts.set(id, decor);
    update();
  }, [id, decor]);
  useLayoutEffect(
    () => () => {
      parts.delete(id);
      update();
    },
    [id],
  );
}
