import { registerBackupSwitches, type BuiltinSwitchSnapshot } from "../../lib/settings-backup/storage.ts";
import { getBuiltinPlugins, onBuiltinPluginsChanged, setBuiltinPluginConfig, setBuiltinPluginEnabled, type BuiltinConfigValue, type BuiltinPlugin } from "./api.ts";
import { loadMigratedSwitches, saveMigratedSwitches } from "./storage.ts";

type Listener = (plugins: readonly BuiltinPlugin[] | null) => void;

let current: readonly BuiltinPlugin[] | null = null;
let listening = false;
let loading = false;
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
  if (!listening) {
    listening = true;
    void Promise.resolve()
      .then(() => onBuiltinPluginsChanged(publish))
      .catch(() => {
        listening = false;
      });
  }
  if (!current && !loading) {
    loading = true;
    const asked = version;
    void Promise.resolve()
      .then(() => getBuiltinPlugins())
      .then((plugins) => {
        if (version === asked) publish(plugins);
      })
      .catch(() => undefined)
      .finally(() => {
        loading = false;
      });
  }
}

export function builtinPlugins(): readonly BuiltinPlugin[] | null {
  return current;
}

export function subscribeBuiltinPlugins(listener: Listener): () => void {
  startBuiltinSwitches();
  listeners.add(listener);
  if (current) listener(current);
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

function snapshotForBackup(): BuiltinSwitchSnapshot | null {
  if (!current) return null;
  return {
    enabled: Object.fromEntries(current.map((plugin) => [plugin.id, plugin.enabled])),
    config: Object.fromEntries(current.map((plugin) => [plugin.id, plugin.config])),
  };
}

registerBackupSwitches({
  snapshot: snapshotForBackup,
  apply(restored) {
    if (restored.migrated.length > 0) {
      saveMigratedSwitches([...loadMigratedSwitches(), ...restored.migrated]);
    }
    for (const [id, enabled] of restored.plugins) {
      if (current?.find((plugin) => plugin.id === id)?.enabled === enabled) continue;
      void switchBuiltinPlugin(id, enabled).catch((error: unknown) => {
        console.error(`Could not restore the built-in plugin ${id}`, error);
      });
    }
    for (const [id, key, value] of restored.configs) {
      if (current?.find((plugin) => plugin.id === id)?.config[key] === value) continue;
      void setBuiltinConfig(id, key, value).catch((error: unknown) => {
        console.error(`Could not restore ${id}.${key}`, error);
      });
    }
  },
  subscribe(listener) {
    const notify: Listener = () => listener();
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  },
});
