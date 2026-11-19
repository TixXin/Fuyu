import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { useMessageAutoClear } from "../plugin/useSourceSwitches";
import { setQQAutoClear } from "./api";

export function useQQAutoClear() {
  const autoClear = useMessageAutoClear();

  useEffect(() => {
    if (isTauri()) void setQQAutoClear(autoClear).catch(() => undefined);
  }, [autoClear]);
}
