import { useEffect, useRef } from "react";
import { windowServices } from "../../features/plugin-kernel/services";
import { useErrorText } from "../../i18n";
import type { OpenedPluginPackage } from "./pluginPageHandoff";

export function usePluginMarketPackage(
  connected: boolean,
  openedPackage: OpenedPluginPackage | null | undefined,
  onConsume: ((seq: number) => void) | undefined,
  offerFile: (base64: string, fileName: string) => Promise<void>,
  onError: (message: string) => void,
) {
  const errorText = useErrorText();
  const handledSeqRef = useRef(0);
  useEffect(() => {
    if (!connected || !openedPackage || handledSeqRef.current === openedPackage.seq) return;
    let cancelled = false;
    let busy = false;
    const run = () => {
      if (cancelled || busy || handledSeqRef.current === openedPackage.seq) return;
      busy = true;
      void offerFile(openedPackage.base64, openedPackage.fileName)
        .then(() => {
          if (cancelled) return;
          handledSeqRef.current = openedPackage.seq;
          onConsume?.(openedPackage.seq);
        })
        .catch((failure: unknown) => {
          busy = false;
          if (cancelled) return;
          const code = (failure as { code?: unknown } | null)?.code;
          if (code === "not-ready" || code === "no-provider") return;
          handledSeqRef.current = openedPackage.seq;
          onConsume?.(openedPackage.seq);
          onError(errorText(failure));
        });
    };
    run();
    const offWatch = windowServices.watch(run);
    return () => {
      cancelled = true;
      offWatch();
    };
  }, [connected, errorText, onConsume, onError, offerFile, openedPackage]);
}
