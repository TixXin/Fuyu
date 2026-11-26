import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getTaskbarLayout } from "../../../lib/taskbar/api";

export function useTaskbarAvailable(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let didCancel = false;
    void getTaskbarLayout()
      .then((bars) => {
        if (!didCancel) setAvailable(Array.isArray(bars) && bars.some((bar) => bar.edge === "bottom"));
      })
      .catch(() => undefined);
    return () => {
      didCancel = true;
    };
  }, []);

  return available;
}
