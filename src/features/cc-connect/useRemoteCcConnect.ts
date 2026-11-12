import { useCallback, useEffect, useState } from "react";
import { useErrorText } from "../../i18n";
import { getAgentRemoteHosts } from "../agent-status/api";
import { getCcConnectRemoteStatus, type CcConnectRemoteStatus } from "./api";
import { remotePath } from "./remotePaths";

export type RemoteCcConnect = { status: CcConnectRemoteStatus | null; error: string | null; reading: boolean };

/**
 * The SSH computers whose sessions the island reads (AI Agent → Remote computers), and, while
 * `active`, the cc-connect on each: read once when shown and on `read` (a refresh), not on a
 * timer, since each read is an ssh. The program path is the plugin page's (remotePaths.ts).
 */
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
    void getAgentRemoteHosts()
      .then((list) => setHosts(list.map((entry) => entry.host)))
      .catch(() => setHosts([]));
  }, []);

  useEffect(() => {
    if (!active) return;
    for (const host of hosts) void read(host);
  }, [active, hosts, read]);

  return { hosts, entries, read };
}
