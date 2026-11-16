import { agentsV1, type AgentSessionEntry } from "@fuyu/plugin-services";
import { useEffect, useState } from "react";
import { windowServices } from "../plugin-kernel/services";
import { ringSessions } from "./ringCounts.ts";

const agents = windowServices.get(agentsV1);
const NO_SESSIONS: readonly AgentSessionEntry[] = [];

export function useRingSessions(): readonly AgentSessionEntry[] {
  const [sessions, setSessions] = useState(NO_SESSIONS);
  useEffect(() => {
    let live = true;
    let asked = 0;
    const load = () => {
      const ask = ++asked;
      agents.sessions().then(
        (answer) => live && ask === asked && setSessions(ringSessions(answer.sessions)),
        () => live && ask === asked && setSessions(NO_SESSIONS),
      );
    };
    load();
    const off = agents.on("changed", load);
    const unwatch = windowServices.watch(load);
    return () => {
      live = false;
      void off();
      unwatch();
    };
  }, []);
  return sessions;
}
