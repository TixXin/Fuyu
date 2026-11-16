import { useEffect, useRef } from "react";
import { emitAgentStatusHostEvent } from "./api";

export function useAgentHostEvent(deps: readonly unknown[], payload: () => Record<string, unknown>) {
  const previous = useRef<readonly unknown[] | null>(null);
  const latestPayload = useRef(payload);
  latestPayload.current = payload;
  useEffect(() => {
    const before = previous.current;
    previous.current = deps;
    if (before === null || (before.length === deps.length && before.every((value, index) => Object.is(value, deps[index])))) return;
    void emitAgentStatusHostEvent(latestPayload.current()).catch((error: unknown) => {
      console.error("Failed to report a plugin host event", error);
    });
  });
}
