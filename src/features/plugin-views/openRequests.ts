export const OPEN_REQUEST_FRESH_MS = 4000;

type Listener = (pluginId: string, viewId: string) => void;

const requests = new Map<string, number>();
const listeners = new Set<Listener>();

const keyOf = (pluginId: string, viewId: string) => `${pluginId}/${viewId}`;

export function noteOpenRequest(pluginId: string, viewId: string, now: number) {
  requests.set(keyOf(pluginId, viewId), now);
  for (const listener of [...listeners]) listener(pluginId, viewId);
}

export function takeOpenRequest(pluginId: string, viewId: string, now: number): boolean {
  const key = keyOf(pluginId, viewId);
  const at = requests.get(key);
  if (at === undefined) return false;
  requests.delete(key);
  return now - at <= OPEN_REQUEST_FRESH_MS;
}

export function onOpenRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
