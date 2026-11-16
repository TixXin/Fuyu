type Invoke = (command: string, args?: unknown, options?: unknown) => Promise<unknown>;

export interface IpcInternals {
  invoke: Invoke;
}

export interface IpcLedger {
  calls(command: string): number;
  listening(event: string): number;
  snapshot(): { calls: Record<string, number>; listening: Record<string, number> };
  stop(): void;
}

const LISTEN = "plugin:event|listen";
const UNLISTEN = "plugin:event|unlisten";

const field = (args: unknown, key: string): unknown => (typeof args === "object" && args !== null ? (args as Record<string, unknown>)[key] : undefined);

export function installIpcLedger(internals: IpcInternals): IpcLedger {
  const original = internals.invoke;
  const calls = new Map<string, number>();
  const live = new Map<unknown, string>();
  const bump = (table: Map<string, number>, name: string, by: number) => table.set(name, (table.get(name) ?? 0) + by);
  const listening = () => {
    const counts = new Map<string, number>();
    for (const event of live.values()) bump(counts, event, 1);
    return counts;
  };
  const wrapped: Invoke = (command, args, options) => {
    if (command === LISTEN) {
      const event = field(args, "event");
      const result = original.call(internals, command, args, options);
      if (typeof event === "string") void result.then((id) => { live.set(id, event); }, () => undefined);
      return result;
    }
    if (command === UNLISTEN) live.delete(field(args, "eventId"));
    else bump(calls, command, 1);
    return original.call(internals, command, args, options);
  };
  internals.invoke = wrapped;
  return {
    calls: (command) => calls.get(command) ?? 0,
    listening: (event) => listening().get(event) ?? 0,
    snapshot: () => ({ calls: Object.fromEntries(calls), listening: Object.fromEntries(listening()) }),
    stop() {
      if (internals.invoke === wrapped) internals.invoke = original;
    },
  };
}
