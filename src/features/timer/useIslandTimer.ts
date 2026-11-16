import { useEffect, useMemo, useRef } from "react";
import { useTimers } from "./store";

export function useIslandTimer(enabled: boolean, openPage: (page: "timer") => void) {
  const { timers, openRequest } = useTimers();
  const handled = useRef(openRequest?.at ?? 0);
  useEffect(() => {
    if (!enabled || !openRequest || openRequest.at === handled.current) return;
    handled.current = openRequest.at;
    openPage("timer");
  }, [enabled, openRequest, openPage]);
  const ringing = useMemo(() => (enabled ? timers.filter((timer) => timer.alerted) : []), [enabled, timers]);
  return { ringing };
}
