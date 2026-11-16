import { useEffect, useRef } from "react";
import { emitPluginHostEvent, type PluginHostEventName } from "./api";

export function useHostChangeEvent(name: PluginHostEventName, deps: readonly unknown[], payload: () => Record<string, unknown>, skip = false) {
  const previous = useRef<readonly unknown[] | null>(null);
  const latestPayload = useRef(payload);
  latestPayload.current = payload;
  useEffect(() => {
    const before = previous.current;
    previous.current = deps;
    if (skip || before === null || (before.length === deps.length && before.every((value, index) => Object.is(value, deps[index])))) {
      return;
    }
    void emitPluginHostEvent(name, latestPayload.current()).catch((error: unknown) => {
      console.error("Failed to report a plugin host event", error);
    });
  });
}
