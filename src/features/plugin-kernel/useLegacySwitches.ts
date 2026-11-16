import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import type { IslandSettings } from "../../lib/settings/types";
import { switchBuiltinPlugin } from "./builtinSwitches.ts";
import { reconcile, switchChanges, withSwitches, type ReconcileState } from "./legacySwitches.ts";
import { loadMigratedSwitches, saveMigratedSwitches } from "./storage.ts";
import { useBuiltinPlugins } from "./useBuiltinPlugins.ts";

type Pair = readonly [IslandSettings, Dispatch<SetStateAction<IslandSettings>>];

function flip(id: string, on: boolean) {
  void switchBuiltinPlugin(id, on).catch((error: unknown) => console.error(`Could not switch the built-in plugin ${id}`, error));
}

function useReconcile(settings: IslandSettings, setSettings: Pair[1], plugins: ReturnType<typeof useBuiltinPlugins>, active: boolean) {
  const seen = useRef<ReconcileState | null>(null);
  useEffect(() => {
    if (!active || !plugins) return;
    const migrated = loadMigratedSwitches();
    const result = reconcile(settings, plugins, seen.current, migrated);
    seen.current = result.seen;
    if (result.migrated.length) saveMigratedSwitches([...migrated, ...result.migrated]);
    for (const [id, on] of result.switch) flip(id, on);
    if (Object.keys(result.mirror).length) setSettings((current) => ({ ...current, ...result.mirror }));
  }, [active, plugins, settings, setSettings]);
}

export function useLegacySwitches([stored, setStored]: Pair, options: { reconcile?: boolean } = {}): Pair {
  const plugins = useBuiltinPlugins();
  const settings = useMemo(() => withSwitches(stored, plugins), [stored, plugins]);
  const latest = useRef({ settings, plugins });
  latest.current = { settings, plugins };
  useReconcile(stored, setStored, plugins, options.reconcile === true);
  const setSettings = useCallback<Pair[1]>((next) => {
    const before = latest.current.settings;
    const after = typeof next === "function" ? next(before) : next;
    for (const [id, on] of switchChanges(before, after)) flip(id, on);
    setStored((current) => {
      const base = withSwitches(current, latest.current.plugins);
      return typeof next === "function" ? next(base) : next;
    });
  }, [setStored]);
  return [settings, setSettings] as const;
}
