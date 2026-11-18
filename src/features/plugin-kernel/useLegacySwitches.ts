import { useEffect, useMemo } from "react";
import type { IslandSettings } from "../../lib/settings/types";
import { switchBuiltinPlugin } from "./builtinSwitches.ts";
import { migrateLegacySwitches, withSwitches } from "./legacySwitches.ts";
import { loadMigratedSwitches, saveMigratedSwitches } from "./storage.ts";
import { useBuiltinPlugins } from "./useBuiltinPlugins.ts";

export function useSettingsWithBuiltinSwitches(stored: IslandSettings): IslandSettings {
  const plugins = useBuiltinPlugins();
  return useMemo(() => withSwitches(stored, plugins), [stored, plugins]);
}

export function useMigrateLegacySwitches(stored: IslandSettings) {
  const plugins = useBuiltinPlugins();
  useEffect(() => {
    if (!plugins) return;
    const migrated = loadMigratedSwitches();
    const result = migrateLegacySwitches(stored, plugins, migrated);
    if (result.migrated.length === 0 && result.switch.length === 0) return;
    if (result.migrated.length > 0) saveMigratedSwitches([...migrated, ...result.migrated]);
    for (const [id, on] of result.switch) {
      void switchBuiltinPlugin(id, on).catch((error: unknown) => {
        console.error(`Could not migrate the built-in plugin ${id}`, error);
      });
    }
  }, [plugins, stored]);
}
