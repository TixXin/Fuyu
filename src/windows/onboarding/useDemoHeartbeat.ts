import { useEffect } from "react";
import { DEMO_RENEW_MS, endIslandDemo, renewIslandDemo } from "./storage";

/** Keeps the island's demo song and agent session on while the guide is open (useOnboardingDemo). */
export function useDemoHeartbeat() {
  useEffect(() => {
    renewIslandDemo();
    const timer = window.setInterval(() => renewIslandDemo(), DEMO_RENEW_MS);
    window.addEventListener("beforeunload", endIslandDemo);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("beforeunload", endIslandDemo);
      endIslandDemo();
    };
  }, []);
}
