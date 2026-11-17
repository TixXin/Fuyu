import { useCallback, useEffect, useState } from "react";
import { visibilityInterval } from "../useVisibilityInterval";
import { getSystemPermissions, type SystemPermission } from "./api";

const RECHECK_MS = 1500;

export function useSystemPermissions() {
  const [permissions, setPermissions] = useState<SystemPermission[]>([]);

  const refresh = useCallback(() => {
    void getSystemPermissions()
      .then((list) => setPermissions(Array.isArray(list) ? list : []))
      .catch((error: unknown) => console.error("Failed to read the system permissions", error));
  }, []);

  useEffect(() => {
    refresh();
    const stop = visibilityInterval(refresh, RECHECK_MS);
    window.addEventListener("focus", refresh);
    return () => {
      stop();
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  return { permissions, refresh };
}
