import { agentsV1 } from "@fuyu/plugin-services";
import { useCallback, useEffect, useState } from "react";
import { useErrorText } from "../../i18n";
import { windowServices } from "../plugin-kernel/services";
import { getCcConnectRemoteStatus, type CcConnectRemoteStatus } from "./api";
import { remotePath } from "./remotePaths";

export type RemoteCcConnect = { status: CcConnectRemoteStatus | null; error: string | null; reading: boolean };

const agents = windowServices.get(agentsV1);

export function useRemoteCcConnect(active: boolean) {
  const errorText = useErrorText();
  const [hosts, setHosts] = useState<string[]>([]);
  const [entries, setEntries] = useState<Record<string, RemoteCcConnect>>({});

  const read = useCallback(
    async (host: string) => {
      setEntries((previous) => ({ ...previous, [host]: { status: previous[host]?.status ?? null, error: null, reading: true } }));
      try {
        const status = await getCcConnectRemoteStatus(host, remotePath(host));
        setEntries((previous) => ({ ...previous, [host]: { status, error: null, reading: false } }));
      } catch (reason) {
        setEntries((previous) => ({ ...previous, [host]: { status: null, error: errorText(reason), reading: false } }));
      }
    },
    [errorText],
  );

  useEffect(() => {
    let cancelled = false;
    void agents
      .remoteHosts()
      .then(({ hosts: list }) => {
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
    if (!active) return;
    for (const host of hosts) void read(host);
  }, [active, hosts, read]);

  return { hosts, entries, read };
}
