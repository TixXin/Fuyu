import { useCallback, useEffect, useState } from "react";
import { useErrorText } from "../../i18n";
import {
  addAgentRemoteHost,
  getAgentCustomHosts,
  getAgentRemoteHosts,
  listSshHosts,
  refreshAgentRemoteHosts,
  removeAgentRemoteHost,
  setAgentRemoteHosts,
  type CustomRemoteHost,
  type RemoteHostStatus,
} from "./api";

const STATUS_POLL_MS = 3_000;

export type RemoteHostEntry = {
  name: string;
  custom: CustomRemoteHost | null;
  status: RemoteHostStatus | null;
};

export function customAddress(custom: CustomRemoteHost) {
  const user = custom.user ? `${custom.user}@` : "";
  const host = custom.host.includes(":") ? `[${custom.host}]` : custom.host;
  return `${user}${host}${custom.port ? `:${custom.port}` : ""}`;
}

export function useRemoteHosts() {
  const errorText = useErrorText();
  const [available, setAvailable] = useState<string[] | null>(null);
  const [custom, setCustom] = useState<CustomRemoteHost[]>([]);
  const [statuses, setStatuses] = useState<RemoteHostStatus[]>([]);
  const [error, setError] = useState("");

  const refreshStatuses = useCallback(() => {
    getAgentRemoteHosts()
      .then((next) => setStatuses(Array.isArray(next) ? next : []))
      .catch((reason: unknown) => console.error("Failed to read remote hosts", reason));
  }, []);

  useEffect(() => {
    listSshHosts()
      .then((next) => setAvailable(Array.isArray(next) ? next : []))
      .catch((reason: unknown) => {
        setAvailable([]);
        setError(errorText(reason));
      });
    getAgentCustomHosts()
      .then((next) => setCustom(Array.isArray(next) ? next : []))
      .catch((reason: unknown) => console.error("Failed to read added remote hosts", reason));
    refreshStatuses();
    const timer = window.setInterval(refreshStatuses, STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [errorText, refreshStatuses]);

  const chosen = statuses.map((status) => status.host);
  const names = [...(available ?? []), ...custom.map((host) => host.name), ...chosen];
  const entries: RemoteHostEntry[] = [...new Set(names)].map((name) => ({
    name,
    custom: custom.find((host) => host.name === name) ?? null,
    status: statuses.find((status) => status.host === name) ?? null,
  }));

  const run = <T,>(action: Promise<T>, then: (value: T) => void) =>
    action
      .then((value) => {
        setError("");
        then(value);
        refreshStatuses();
        return true;
      })
      .catch((reason: unknown) => {
        setError(errorText(reason));
        return false;
      });

  return {
    loaded: available !== null,
    entries,
    error,
    toggle: (name: string, on: boolean) =>
      void run(setAgentRemoteHosts(on ? [...chosen, name] : chosen.filter((known) => known !== name)), () => undefined),
    add: (host: CustomRemoteHost) => run(addAgentRemoteHost(host), setCustom),
    remove: (name: string) => void run(removeAgentRemoteHost(name), setCustom),
    refresh: () => run(refreshAgentRemoteHosts(), () => undefined),
  };
}
