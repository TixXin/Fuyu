import { useEffect, useState } from "react";
import { quickAppInfo, type QuickAppInfo } from "./api";

const cache = new Map<string, Promise<QuickAppInfo | null>>();

export function rememberAppInfo(info: QuickAppInfo) {
  cache.set(info.path, Promise.resolve(info));
}

function loadAppInfo(path: string) {
  let found = cache.get(path);
  if (!found) {
    found = quickAppInfo(path).catch(() => null);
    cache.set(path, found);
  }
  return found;
}

export function useAppInfo(path: string | null): QuickAppInfo | null | undefined {
  const [info, setInfo] = useState<{ path: string; value: QuickAppInfo | null } | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    void loadAppInfo(path).then((value) => {
      if (alive) setInfo({ path, value });
    });
    return () => {
      alive = false;
    };
  }, [path]);
  return path && info?.path === path ? info.value : undefined;
}
