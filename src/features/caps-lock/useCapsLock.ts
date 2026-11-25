import { useEffect, useRef, useState } from "react";
import { isMacOS } from "../../lib/platform";
import {
  CAPS_LOCK_DEMO_KEY,
  consumeCapsLockDemo,
  getCapsLockState,
  listenCapsLock,
  listenCapsLockDemo,
  listenCapsLockPasswordField,
  listenNumLock,
} from "./api";
import { shouldFlash, shouldFlashNumLock, type CapsLockConfig } from "./capsLockConfig.ts";

export const CAPS_LOCK_ALERT_MS = 1500;
export const CAPS_LOCK_OFF_ALERT_MS = 900;

export type CapsLockAlert = { key: "caps" | "num"; on: boolean; at: number; password?: boolean };

export function useCapsLock(config: CapsLockConfig, show: boolean, allowPassword: boolean): { on: boolean; alert: CapsLockAlert | null } {
  const [on, setOn] = useState(false);
  const [passwordField, setPasswordField] = useState(false);
  const [transient, setTransient] = useState<CapsLockAlert | null>(null);
  const latest = useRef({ config, show });
  latest.current = { config, show };

  useEffect(() => {
    let cancelled = false;
    const unlisteners: (() => void)[] = [];
    const register = (promise: Promise<() => void>, label: string) => {
      void promise
        .then((stop) => {
          if (cancelled) stop();
          else unlisteners.push(stop);
        })
        .catch((error: unknown) => console.error(`Failed to listen for ${label}`, error));
    };
    const triggerDemo = () => {
      if (latest.current.show) setTransient({ key: "caps", on: true, at: Date.now() });
    };
    if (consumeCapsLockDemo()) triggerDemo();

    void getCapsLockState()
      .then((state) => {
        if (!cancelled) setOn(state);
      })
      .catch((error: unknown) => console.error("Failed to read Caps Lock", error));

    register(
      listenCapsLock((change) => {
        setOn(change.on);
        if (!change.on) setPasswordField(false);
        if (latest.current.show && shouldFlash(change, latest.current.config)) {
          setTransient({ key: "caps", on: change.on, at: Date.now() });
        }
      }),
      "Caps Lock",
    );
    register(
      listenNumLock((change) => {
        if (latest.current.show && shouldFlashNumLock(change, latest.current.config, isMacOS)) {
          setTransient({ key: "num", on: change.on, at: Date.now() });
        }
      }),
      "Num Lock",
    );
    register(
      listenCapsLockPasswordField((focused) => {
        setPasswordField(focused);
      }),
      "Caps Lock password field",
    );
    register(
      listenCapsLockDemo(() => {
        consumeCapsLockDemo();
        triggerDemo();
      }),
      "Caps Lock demo",
    );
    const onStorage = (event: StorageEvent) => {
      if (event.key === CAPS_LOCK_DEMO_KEY && event.newValue !== null && consumeCapsLockDemo()) {
        triggerDemo();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      for (const stop of unlisteners) stop();
    };
  }, []);

  useEffect(() => {
    if (!show) setTransient(null);
  }, [show]);

  useEffect(() => {
    if (!transient) return;
    const timer = window.setTimeout(() => setTransient(null), transient.on ? CAPS_LOCK_ALERT_MS : CAPS_LOCK_OFF_ALERT_MS);
    return () => window.clearTimeout(timer);
  }, [transient]);

  const persistentPassword: CapsLockAlert | null =
    !isMacOS && allowPassword && show && on && passwordField && config.passwordWarn
      ? { key: "caps", on: true, at: 0, password: true }
      : null;

  return { on, alert: persistentPassword ?? transient };
}
