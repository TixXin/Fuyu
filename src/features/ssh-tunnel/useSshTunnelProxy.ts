import { useEffect, useState } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { getSshTunnelProxy, type SshTunnelProxy } from "./api";

const POLL_MS = 3_000;

export function useSshTunnelProxy(on: boolean) {
  const [proxy, setProxy] = useState<SshTunnelProxy | null>(null);

  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    const read = () =>
      void getSshTunnelProxy()
        .then((next) => !cancelled && setProxy(next))
        .catch(() => !cancelled && setProxy(null));
    read();
    const stop = visibilityInterval(read, POLL_MS);
    return () => {
      cancelled = true;
      stop();
    };
  }, [on]);

  return on ? proxy : null;
}
