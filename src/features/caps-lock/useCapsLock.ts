import { useEffect, useRef, useState } from "react";
import { getCapsLockState, listenCapsLock } from "./api";
import { shouldFlash, type CapsLockConfig } from "./capsLockConfig.ts";

export const CAPS_LOCK_ALERT_MS = 1500;

export type CapsLockAlert = { on: boolean; at: number };

export function useCapsLock(config: CapsLockConfig, show: boolean): { on: boolean; alert: CapsLockAlert | null } {
  const [on, setOn] = useState(false);
  const [alert, setAlert] = useState<CapsLockAlert | null>(null);
  const latest = useRef({ config, show });
  latest.current = { config, show };

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void getCapsLockState()
      .then((state) => {
        if (!cancelled) setOn(state);
      })
      .catch((error: unknown) => console.error("Failed to read Caps Lock", error));
    void listenCapsLock((change) => {
      setOn(change.on);
      if (latest.current.show && shouldFlash(change, latest.current.config)) setAlert({ on: change.on, at: Date.now() });
    })
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => console.error("Failed to listen for Caps Lock", error));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!show) setAlert(null);
  }, [show]);

  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => setAlert(null), CAPS_LOCK_ALERT_MS);
    return () => window.clearTimeout(timer);
  }, [alert]);

  return { on, alert };
}
