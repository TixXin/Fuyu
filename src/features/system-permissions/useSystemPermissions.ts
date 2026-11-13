import { useCallback, useEffect, useState } from "react";
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
    const timer = window.setInterval(refresh, RECHECK_MS);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  return { permissions, refresh };
}
