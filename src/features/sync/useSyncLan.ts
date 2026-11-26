import { useCallback, useEffect, useState } from "react";
import {
  cancelSyncLanPairing,
  getSyncLanState,
  joinSyncLan,
  removeSyncLanPeer,
  setSyncLan,
  setSyncLanClipPush,
  startSyncLanPairing,
  type LanState,
  type SyncStatus,
} from "./api";
import { activeSyncBackend, enabledCategories } from "./syncState";

const POLL_MS = 3_000;
const PAIRING_POLL_MS = 1_000;

export function useSyncLan(status: SyncStatus) {
  const [state, setState] = useState<LanState | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [working, setWorking] = useState(false);
  const active = activeSyncBackend(status) === "lan";
  const pairing = Boolean(state?.pairing);

  const refresh = useCallback(async () => {
    try {
      setState(await getSyncLanState());
    } catch {
      setState(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (!active) return;
    const timer = window.setInterval(() => void refresh(), pairing ? PAIRING_POLL_MS : POLL_MS);
    return () => window.clearInterval(timer);
  }, [active, pairing, refresh]);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setWorking(true);
      setError(null);
      try {
        await action();
        await refresh();
        return true;
      } catch (caught) {
        setError(caught);
        return false;
      } finally {
        setWorking(false);
      }
    },
    [refresh],
  );

  return {
    state,
    error,
    working,
    active,
    enable: () => run(() => setSyncLan(enabledCategories(status), status.optionalGroups)),
    showCode: () => run(startSyncLanPairing),
    cancelCode: () => run(cancelSyncLanPairing),
    join: (address: string, code: string) => run(() => joinSyncLan(address, code)),
    remove: (fingerprint: string) => run(() => removeSyncLanPeer(fingerprint)),
    setClipPush: (enabled: boolean) => run(() => setSyncLanClipPush(enabled)),
  };
}
