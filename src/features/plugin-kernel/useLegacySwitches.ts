import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import type { IslandSettings } from "../../lib/settings/types";
import { setBuiltinConfig, switchBuiltinPlugin } from "./builtinSwitches.ts";
import { reconcile, switchChanges, withSwitches, type ReconcileState, type SwitchTarget } from "./legacySwitches.ts";
import { loadMigratedSwitches, saveMigratedSwitches } from "./storage.ts";
import { useBuiltinPlugins } from "./useBuiltinPlugins.ts";

type Pair = readonly [IslandSettings, Dispatch<SetStateAction<IslandSettings>>];

function flip(target: SwitchTarget, on: boolean) {
  const write = typeof target === "string" ? switchBuiltinPlugin(target, on) : setBuiltinConfig(target.plugin, target.key, on);
  const name = typeof target === "string" ? target : `${target.plugin}.${target.key}`;
  void write.catch((error: unknown) => console.error(`Could not switch the built-in plugin ${name}`, error));
}

function useReconcile(settings: IslandSettings, setSettings: Pair[1], plugins: ReturnType<typeof useBuiltinPlugins>, active: boolean) {
  const seen = useRef<ReconcileState | null>(null);
  useEffect(() => {
    if (!active || !plugins) return;
    const migrated = loadMigratedSwitches();
    const result = reconcile(settings, plugins, seen.current, migrated);
    seen.current = result.seen;
    if (result.migrated.length) saveMigratedSwitches([...migrated, ...result.migrated]);
    for (const [target, on] of result.switch) flip(target, on);
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
    for (const [target, on] of switchChanges(before, after)) flip(target, on);
    setStored((current) => {
      const base = withSwitches(current, latest.current.plugins);
      return typeof next === "function" ? next(base) : next;
    });
  }, [setStored]);
  return [settings, setSettings] as const;
}
