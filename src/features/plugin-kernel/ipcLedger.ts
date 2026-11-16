type Invoke = (command: string, args?: unknown, options?: unknown) => Promise<unknown>;

export interface IpcInternals {
  invoke: Invoke;
}

export interface IpcLedger {
  readonly recording: boolean;
  calls(command: string): number;
  listening(event: string): number;
  snapshot(): { calls: Record<string, number>; listening: Record<string, number> };
  stop(): void;
}

const LISTEN = "plugin:event|listen";
const UNLISTEN = "plugin:event|unlisten";

function replaceInvoke(internals: IpcInternals, value: Invoke): PropertyDescriptor | null | false {
  const own = Object.getOwnPropertyDescriptor(internals, "invoke");
  try {
    if (own?.configurable) {
      Object.defineProperty(internals, "invoke", { configurable: true, enumerable: own.enumerable ?? true, writable: true, value });
    } else if (!own || own.writable) {
      internals.invoke = value;
    } else {
      return false;
    }
  } catch {
    return false;
  }
  return internals.invoke === value ? (own?.configurable ? own : null) : false;
}

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
  const replaced = replaceInvoke(internals, wrapped);
  const recording = replaced !== false;
  return {
    recording,
    calls: (command) => calls.get(command) ?? 0,
    listening: (event) => listening().get(event) ?? 0,
    snapshot: () => ({ calls: Object.fromEntries(calls), listening: Object.fromEntries(listening()) }),
    stop() {
      if (!recording || internals.invoke !== wrapped) return;
      try {
        if (replaced) Object.defineProperty(internals, "invoke", replaced);
        else internals.invoke = original;
      } catch {
        return;
      }
    },
  };
}
