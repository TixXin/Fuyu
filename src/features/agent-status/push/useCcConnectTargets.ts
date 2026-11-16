import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useErrorText } from "../../../i18n";
import { ccConnectReason, ccConnectV1, type CcConnectTargets } from "../../../lib/cc-connect/service";
import { windowServices } from "../../plugin-kernel/services";
import { getAgentRemoteHosts } from "../api";
import { LOCAL_HOST } from "./storage";

export type TargetsEntry = { status: CcConnectTargets | null; error: string | null; reading: boolean };

const ccConnect = windowServices.get(ccConnectV1);

const ready = () => windowServices.has(ccConnectV1.name);

function watch(listener: () => void) {
  const stop = windowServices.watch(listener);
  return () => {
    stop();
  };
}

export function useCcConnectTargets(active: boolean) {
  const on = useSyncExternalStore(watch, ready, ready);
  const errorText = useErrorText();
  const [hosts, setHosts] = useState<string[]>([]);
  const [entries, setEntries] = useState<Record<string, TargetsEntry>>({});

  const read = useCallback(
    async (host: string) => {
      setEntries((previous) => ({ ...previous, [host]: { status: previous[host]?.status ?? null, error: null, reading: true } }));
      try {
        const status = await ccConnect.targets({ host });
        setEntries((previous) => ({ ...previous, [host]: { status, error: null, reading: false } }));
      } catch (reason) {
        setEntries((previous) => ({ ...previous, [host]: { status: null, error: errorText(ccConnectReason(reason)), reading: false } }));
      }
    },
    [errorText],
  );

  useEffect(() => {
    let cancelled = false;
    void getAgentRemoteHosts()
      .then((list) => {
        if (!cancelled) setHosts(list.map((entry) => entry.host));
      })
      .catch(() => {
        if (!cancelled) setHosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!active || !on) return;
    for (const host of [LOCAL_HOST, ...hosts]) void read(host);
  }, [active, on, hosts, read]);

  return { on, hosts, entries, read };
}
