import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { useMessageAutoClear } from "../plugin/useSourceSwitches";
import { setWeChatAutoClear } from "./api";

export function useWeChatAutoClear() {
  const autoClear = useMessageAutoClear();

  useEffect(() => {
    if (isTauri()) void setWeChatAutoClear(autoClear).catch(() => undefined);
  }, [autoClear]);
}
