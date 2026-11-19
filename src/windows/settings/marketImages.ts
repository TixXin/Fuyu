import { useEffect, useSyncExternalStore } from "react";
import { marketClient } from "./pluginMarketActions";

const RETRY_AFTER_MS = 30 * 1000;

const resolved = new Map<string, string>();
const missedAt = new Map<string, number>();
const pending = new Set<string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function settle(url: string, data: string | null) {
  pending.delete(url);
  resolved.set(url, data ?? url);
  if (data === null) missedAt.set(url, Date.now());
  else missedAt.delete(url);
  for (const listener of [...listeners]) listener();
}

function request(url: string) {
  if (pending.has(url)) return;
  const missed = missedAt.get(url);
  if (resolved.has(url) && (missed === undefined || Date.now() - missed < RETRY_AFTER_MS)) return;
  pending.add(url);
  void marketClient
    .media({ url })
    .then((media) => settle(url, media.data))
    .catch(() => settle(url, null));
}

export function isMarketImage(url: string | null | undefined): url is string {
  return typeof url === "string" && /^https:\/\//i.test(url);
}

export function useMarketImage(url: string | null | undefined, wanted = true): string | null {
  const remote = isMarketImage(url);
  useEffect(() => {
    if (remote && wanted) request(url);
  }, [remote, wanted, url]);
  const src = useSyncExternalStore(subscribe, () => (remote ? resolved.get(url) ?? null : null));
  return remote ? src : url ?? null;
}
