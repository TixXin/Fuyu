import { useCallback, useEffect, useState } from "react";
import { useErrorText } from "../../i18n";
import { useBuiltinPlugins } from "../plugin-kernel/useBuiltinPlugins";
import { getLocalApiInfo, resetLocalApiToken, type LocalApiInfo } from "./api";
import { OWNER } from "./plugin/owner.ts";

export function useLocalApiInfo() {
  const errorText = useErrorText();
  const plugin = useBuiltinPlugins()?.find((item) => item.id === OWNER);
  const running = plugin?.background.some((background) => background.running) ?? false;
  const [info, setInfo] = useState<LocalApiInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const settle = useCallback(
    (request: Promise<LocalApiInfo>) =>
      request.then(
        (next) => {
          setInfo(next);
          setError(null);
        },
        (reason: unknown) => setError(errorText(reason)),
      ),
    [errorText],
  );

  useEffect(() => {
    void settle(getLocalApiInfo());
  }, [settle, running]);

  const resetToken = useCallback(() => settle(resetLocalApiToken()), [settle]);

  return { info, error, allowWrite: plugin?.config.allowWrite === true, resetToken };
}
