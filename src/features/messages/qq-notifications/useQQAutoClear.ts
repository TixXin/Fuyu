import { useCallback, useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { setQQAutoClear } from "./api";
import { isQQAutoClearEnabled, saveQQAutoClearEnabled } from "./storage";

export function useQQAutoClear() {
  const [autoClear, setAutoClearState] = useState(isQQAutoClearEnabled);

  useEffect(() => {
    if (isTauri()) void setQQAutoClear(autoClear).catch(() => undefined);
  }, [autoClear]);

  const setAutoClear = useCallback((enabled: boolean) => {
    saveQQAutoClearEnabled(enabled);
    setAutoClearState(enabled);
  }, []);

  return { autoClear, setAutoClear };
}
