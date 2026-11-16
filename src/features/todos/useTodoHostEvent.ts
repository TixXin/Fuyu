import { useEffect, useRef } from "react";
import { emitTodoHostEvent, type TodoHostEventName } from "./api";

export function useTodoHostEvent(name: TodoHostEventName, deps: readonly unknown[], date: string, skip: boolean) {
  const previous = useRef<readonly unknown[] | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = deps;
    if (skip || before === null || (before.length === deps.length && before.every((value, index) => Object.is(value, deps[index])))) return;
    void emitTodoHostEvent(name, { date }).catch((error: unknown) => {
      console.error("Failed to report a plugin host event", error);
    });
  });
}
