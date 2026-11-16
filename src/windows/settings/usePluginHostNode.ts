import { useCallback, useEffect, useState } from "react";
import { getPluginHostConnection, retryPluginHostNode, type HostNodeStatus } from "../../features/plugin-kernel/api";

export const NODE_EVERY_MS = 1000;

export interface PluginHostNode {
  node: HostNodeStatus | null;
  retry: () => void;
}

export function usePluginHostNode(watching: boolean): PluginHostNode {
  const [node, setNode] = useState<HostNodeStatus | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!watching) return;
    let live = true;
    const read = () =>
      void getPluginHostConnection()
        .then((connection) => {
          if (live) setNode(connection.node ?? null);
        })
        .catch(() => undefined);
    read();
    const timer = window.setInterval(read, NODE_EVERY_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [watching, round]);
  const retry = useCallback(() => {
    setNode({ state: "checking" });
    void retryPluginHostNode()
      .catch(() => false)
      .then(() => setRound((value) => value + 1));
  }, []);
  return { node: watching ? node : null, retry };
}
