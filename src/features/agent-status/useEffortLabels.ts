import { useEffect, useState } from "react";
import { listAgentEffortLabels } from "./api";
import type { AgentEffortLabels } from "./effortLabels";

const REFRESH_MS = 5000;

export function useEffortLabels(): AgentEffortLabels {
  const [labels, setLabels] = useState<AgentEffortLabels>({});

  useEffect(() => {
    let cancelled = false;
    let lastText = "";
    const refresh = () => {
      listAgentEffortLabels()
        .then((answer) => {
          const next = answer ?? {};
          const text = JSON.stringify(next);
          if (cancelled || text === lastText) return;
          lastText = text;
          setLabels(next);
        })
        .catch((error: unknown) => console.error("Failed to read the plugins' effort labels", error));
    };
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return labels;
}
