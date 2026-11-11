import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useErrorText } from "../../../i18n";
import { getCcConnectRemoteStatus, type CcConnectRemoteStatus } from "../../cc-connect";
import { getAgentRemoteHosts } from "../api";
import { pushHost, type AgentPushSettings } from "./storage";

export type RemoteCcConnect = { status: CcConnectRemoteStatus | null; error: string | null; reading: boolean };

/**
 * The SSH computers whose sessions the island reads (AI Agent → Remote computers), and, while
 * `active`, the cc-connect on each: read once when shown and on `read` (a refresh), not on a
 * timer, since each read is an ssh.
 */
export function useRemoteCcConnect(active: boolean, settings: AgentPushSettings) {
  const errorText = useErrorText();
  const [hosts, setHosts] = useState<string[]>([]);
  const [entries, setEntries] = useState<Record<string, RemoteCcConnect>>({});
  const latest = useRef(settings);
  useLayoutEffect(() => {
    latest.current = settings;
  });

  const read = useCallback(
    async (host: string) => {
      setEntries((previous) => ({ ...previous, [host]: { status: previous[host]?.status ?? null, error: null, reading: true } }));
      try {
        const status = await getCcConnectRemoteStatus(host, pushHost(latest.current, host).path);
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
