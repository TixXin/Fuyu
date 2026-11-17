import { useCallback, useEffect, useState } from "react";
import { useErrorText } from "../../i18n";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { useBuiltinConfig } from "../plugin-kernel/useBuiltinPlugins";
import { getCcConnectStatus, programSetting, type CcConnectStatus } from "./api";
import { OWNER } from "./plugin/owner.ts";

const REFRESH_MS = 5_000;

export function useCcConnect() {
  const config = useBuiltinConfig(OWNER);
  const path = programSetting(config);
  const errorText = useErrorText();
  const [status, setStatus] = useState<CcConnectStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getCcConnectStatus(path));
      setError(null);
    } catch (reason) {
      setError(errorText(reason));
    }
  }, [path, errorText]);

  useEffect(() => {
    void refresh();
    return visibilityInterval(() => void refresh(), REFRESH_MS);
  }, [refresh]);

  return { path, run: config.run === true, status, error, refresh };
}
