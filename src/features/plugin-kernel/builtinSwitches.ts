import { getBuiltinPlugins, onBuiltinPluginsChanged, setBuiltinPluginEnabled, type BuiltinPlugin } from "./api.ts";

type Listener = (plugins: readonly BuiltinPlugin[] | null) => void;

let current: readonly BuiltinPlugin[] | null = null;
let started = false;
let version = 0;
const listeners = new Set<Listener>();

export function normalizeBuiltinPlugins(value: unknown): BuiltinPlugin[] | null {
  if (!Array.isArray(value)) return null;
  const plugins: BuiltinPlugin[] = [];
  for (const item of value as unknown[]) {
    if (typeof item !== "object" || item === null) continue;
    const { id, kind, enabled, background } = item as Record<string, unknown>;
    if (typeof id !== "string" || typeof enabled !== "boolean") continue;
    plugins.push({
      id,
      kind: kind === "essential" ? "essential" : "builtin",
      enabled,
      background: Array.isArray(background)
        ? background.flatMap((entry: unknown) => {
            const { name, registered, running } = (entry ?? {}) as Record<string, unknown>;
            return typeof name === "string" ? [{ name, registered: registered === true, running: running === true }] : [];
          })
        : [],
    });
  }
  return plugins;
}

function publish(value: unknown) {
  const next = normalizeBuiltinPlugins(value);
  if (!next) return;
  version += 1;
  current = next;
  for (const listener of listeners) listener(next);
}

export function disabledBuiltinIds(plugins: readonly BuiltinPlugin[] | null): string[] {
  return (plugins ?? []).filter((plugin) => !plugin.enabled).map((plugin) => plugin.id);
}

export function startBuiltinSwitches() {
  if (started) return;
  started = true;
  const asked = version;
  void onBuiltinPluginsChanged(publish).catch(() => undefined);
  void getBuiltinPlugins()
    .then((plugins) => {
      if (version === asked) publish(plugins);
    })
    .catch(() => undefined);
}

export function builtinPlugins(): readonly BuiltinPlugin[] | null {
  return current;
}

export function subscribeBuiltinPlugins(listener: Listener): () => void {
  startBuiltinSwitches();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function switchBuiltinPlugin(id: string, enabled: boolean): Promise<void> {
  publish(await setBuiltinPluginEnabled(id, enabled));
}
