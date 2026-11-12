import { useEffect, useState } from "react";
import { readJson, writeJson } from "../../lib/storage.ts";

export const CC_CONNECT_REMOTE_PATHS_KEY = "fuyu-cc-connect-remote-paths";

/** Where cc-connect is on each SSH computer, set on the plugin page; missing or empty finds it there. */
export type CcConnectRemotePaths = Record<string, string>;

const MAX_HOSTS = 20;

export function normalizeRemotePaths(value: unknown): CcConnectRemotePaths {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([host, path]) => host.length > 0 && host.length <= 128 && typeof path === "string")
    .map(([host, path]) => [host, (path as string).trim().slice(0, 1024)] as const)
    .filter(([, path]) => path !== "");
  return Object.fromEntries(entries.slice(0, MAX_HOSTS));
}

export function loadRemotePaths(): CcConnectRemotePaths {
  return normalizeRemotePaths(readJson(CC_CONNECT_REMOTE_PATHS_KEY));
}

/** The program path set for `host`; "" finds it. */
export function remotePath(host: string) {
  return loadRemotePaths()[host] ?? "";
}

/** The paths, saved on every change and kept in sync between windows. */
export function useRemotePaths() {
  const [paths, setPaths] = useState<CcConnectRemotePaths>(loadRemotePaths);

  useEffect(() => {
    writeJson(CC_CONNECT_REMOTE_PATHS_KEY, paths);
  }, [paths]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === CC_CONNECT_REMOTE_PATHS_KEY) setPaths(loadRemotePaths());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const setPath = (host: string, path: string) => setPaths((previous) => ({ ...previous, [host]: path }));
  return [paths, setPath] as const;
}
