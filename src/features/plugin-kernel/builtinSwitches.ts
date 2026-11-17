import { getBuiltinPlugins, onBuiltinPluginsChanged, setBuiltinPluginConfig, setBuiltinPluginEnabled, type BuiltinConfigValue, type BuiltinPlugin } from "./api.ts";

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
    const { id, kind, enabled, background, config } = item as Record<string, unknown>;
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
      config: typeof config === "object" && config !== null && !Array.isArray(config) ? { ...(config as Record<string, unknown>) } : {},
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

export function isBuiltinEnabled(plugins: readonly BuiltinPlugin[] | null, id: string, fallback = true): boolean {
  if (!plugins) return fallback;
  return plugins.find((plugin) => plugin.id === id)?.enabled ?? fallback;
}

export function builtinConfigBoolean(plugins: readonly BuiltinPlugin[] | null, id: string, key: string): boolean | undefined {
  const value = plugins?.find((plugin) => plugin.id === id)?.config[key];
  return typeof value === "boolean" ? value : undefined;
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

export async function setBuiltinConfig(id: string, key: string, value: BuiltinConfigValue | null): Promise<void> {
  publish(await setBuiltinPluginConfig(id, key, value));
}
