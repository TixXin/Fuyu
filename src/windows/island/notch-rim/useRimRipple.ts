import { useEffect, useRef, useState } from "react";
import type { RimStatus } from "./rimLook.ts";

export const RIM_RIPPLE_MS = 1200;

const statusKey = (status: RimStatus) => (status ? `${status.color}|${status.pulse ? 1 : 0}` : "");

export function useRimRipple(status: RimStatus) {
  const key = statusKey(status);
  const [ripple, setRipple] = useState({ key: 0, active: false });
  const lastRef = useRef(key);

  useEffect(() => {
    if (key === lastRef.current) return;
    lastRef.current = key;
    if (key === "") {
      setRipple((current) => (current.active ? { ...current, active: false } : current));
      return;
    }
    setRipple((current) => ({ key: current.key + 1, active: true }));
    const timer = window.setTimeout(() => setRipple((current) => ({ ...current, active: false })), RIM_RIPPLE_MS);
    return () => window.clearTimeout(timer);
  }, [key]);

  return ripple;
}
