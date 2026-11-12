import { useCallback, useEffect, useState } from "react";
import { useErrorText } from "../../i18n";
import { checkSshTunnelPort, getSshTunnels, setSshTunnel, type SshTunnelHost } from "./api";

const STATUS_POLL_MS = 3_000;

export type TakenPort = { host: string; port: number; unchecked: string | null };

export function useSshTunnels() {
  const errorText = useErrorText();
  const [hosts, setHosts] = useState<SshTunnelHost[] | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState<string | null>(null);
  const [taken, setTaken] = useState<TakenPort | null>(null);

  const refresh = useCallback(() => {
    getSshTunnels()
      .then((next) => setHosts(Array.isArray(next) ? next : []))
      .catch((reason: unknown) => {
        setHosts((current) => current ?? []);
        setError(errorText(reason));
      });
  }, [errorText]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const save = (host: string, enabled: boolean, port: number | null) =>
    void setSshTunnel(host, enabled, port)
      .then((next) => {
        setError("");
        setHosts(next);
      })
      .catch((reason: unknown) => setError(errorText(reason)));

  const switchOn = (host: string, port: number) => {
    setChecking(host);
    checkSshTunnelPort(host, port)
      .then((inUse) => (inUse ? setTaken({ host, port, unchecked: null }) : save(host, true, port)))
      .catch((reason: unknown) => setTaken({ host, port, unchecked: errorText(reason) }))
      .finally(() => setChecking((current) => (current === host ? null : current)));
  };

  return {
    hosts,
    error,
    checking,
    taken,
    toggle: (entry: SshTunnelHost, on: boolean, port: number | null) =>
      on && port !== null ? switchOn(entry.host, port) : on ? undefined : save(entry.host, false, port),
    setPort: (entry: SshTunnelHost, port: number | null) => {
      if (port === entry.remotePort) return;
      if (entry.enabled && port !== null) switchOn(entry.host, port);
      else save(entry.host, false, port);
    },
    answer: (yes: boolean) => {
      if (!taken) return;
      setTaken(null);
      save(taken.host, yes, taken.port);
    },
  };
}
