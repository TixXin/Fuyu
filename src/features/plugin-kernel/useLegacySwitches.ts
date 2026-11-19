import { useEffect, useMemo } from "react";
import type { IslandSettings } from "../../lib/settings/types";
import { switchBuiltinPlugin } from "./builtinSwitches.ts";
import { runLegacyMigration, withSwitches } from "./legacySwitches.ts";
import { loadMigratedSwitches, saveMigratedSwitches } from "./storage.ts";
import { useBuiltinPlugins } from "./useBuiltinPlugins.ts";

export function useSettingsWithBuiltinSwitches(stored: IslandSettings): IslandSettings {
  const plugins = useBuiltinPlugins();
  return useMemo(() => withSwitches(stored, plugins), [stored, plugins]);
}

const tried = new Set<string>();

export function useMigrateLegacySwitches(stored: IslandSettings) {
  const plugins = useBuiltinPlugins();
  useEffect(() => {
    if (!plugins) return;
    void runLegacyMigration(stored, plugins, {
      load: loadMigratedSwitches,
      save: saveMigratedSwitches,
      switchPlugin: switchBuiltinPlugin,
      onError: (id, error) => console.error(`Could not migrate the built-in plugin ${id}`, error),
    }, tried);
  }, [plugins, stored]);
}
