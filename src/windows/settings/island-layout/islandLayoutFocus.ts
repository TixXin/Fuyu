const openers = new Set<() => void>();
const listeners = new Set<(item: string) => void>();
let pending: string | null = null;

export function openIslandLayoutItem(item: string) {
  pending = item;
  for (const open of openers) open();
  for (const listener of listeners) listener(item);
}

export function onOpenIslandLayout(open: () => void): () => void {
  openers.add(open);
  return () => openers.delete(open);
}

export function takeIslandLayoutItem(): string | null {
  const item = pending;
  pending = null;
  return item;
}

export function onIslandLayoutItem(listener: (item: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
