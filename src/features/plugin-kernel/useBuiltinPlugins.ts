import { useSyncExternalStore } from "react";
import type { BuiltinPlugin } from "./api";
import { builtinPlugins, subscribeBuiltinPlugins } from "./builtinSwitches";

export function useBuiltinPlugins(): readonly BuiltinPlugin[] | null {
  return useSyncExternalStore(subscribeBuiltinPlugins, builtinPlugins, builtinPlugins);
}

export function useBuiltinEnabled(id: string): boolean {
  const plugins = useBuiltinPlugins();
  return plugins?.find((plugin) => plugin.id === id)?.enabled ?? true;
}

const NO_CONFIG: Readonly<Record<string, unknown>> = Object.freeze({});

export function useBuiltinConfig(id: string): Readonly<Record<string, unknown>> {
  const plugins = useBuiltinPlugins();
  return plugins?.find((plugin) => plugin.id === id)?.config ?? NO_CONFIG;
}
