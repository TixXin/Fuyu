import { useCallback, useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { setWeChatAutoClear } from "./api";
import { isWeChatAutoClearEnabled, saveWeChatAutoClearEnabled } from "./storage";

export function useWeChatAutoClear() {
  const [autoClear, setAutoClearState] = useState(isWeChatAutoClearEnabled);

  useEffect(() => {
    if (isTauri()) void setWeChatAutoClear(autoClear).catch(() => undefined);
  }, [autoClear]);

  const setAutoClear = useCallback((enabled: boolean) => {
    saveWeChatAutoClearEnabled(enabled);
    setAutoClearState(enabled);
  }, []);

  return { autoClear, setAutoClear };
}
