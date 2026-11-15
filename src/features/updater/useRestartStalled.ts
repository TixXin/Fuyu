import { useEffect, useState } from "react";
import type { UpdateStage } from "./updaterController";

export const RESTART_STALL_MS = 15_000;

export function useRestartStalled(stage: UpdateStage) {
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    setStalled(false);
    if (stage !== "done") return;
    const timer = window.setTimeout(() => setStalled(true), RESTART_STALL_MS);
    return () => window.clearTimeout(timer);
  }, [stage]);

  return stage === "done" && stalled;
}
