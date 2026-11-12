import { useCallback, useEffect, useState } from "react";
import type { PluginPagePrefs } from "./pagePrefs";
import { loadPluginPagePrefs, savePluginPagePrefs, subscribePluginPagePrefs } from "./storage";

export function usePluginPagePrefs() {
  const [prefs, setPrefs] = useState<PluginPagePrefs>(loadPluginPagePrefs);

  useEffect(() => subscribePluginPagePrefs(setPrefs), []);

  const update = useCallback((next: PluginPagePrefs) => {
    setPrefs(next);
    savePluginPagePrefs(next);
  }, []);

  return [prefs, update] as const;
}
