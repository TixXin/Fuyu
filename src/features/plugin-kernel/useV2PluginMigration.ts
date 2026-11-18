import { useCallback, useEffect, useState } from "react";
import {
  dismissV2PluginMigration,
  getV2PluginMigration,
  onV2PluginMigrationChanged,
} from "./api";
import {
  EMPTY_V2_MIGRATION,
  type V2MigrationDismissTarget,
  type V2MigrationSnapshot,
} from "./v2Migration";

export function useV2PluginMigration() {
  const [snapshot, setSnapshot] = useState<V2MigrationSnapshot>(EMPTY_V2_MIGRATION);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;

    void getV2PluginMigration()
      .then((next) => {
        if (!cancelled) setSnapshot(next);
      })
      .catch(() => undefined);

    void onV2PluginMigrationChanged((next) => {
      if (!cancelled) setSnapshot(next);
    })
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const dismiss = useCallback((target: V2MigrationDismissTarget) => {
    setSnapshot((prev) => ({
      ...prev,
      islandPending: target === "island" || target === "all" ? false : prev.islandPending,
      settingsPending: target === "settings" || target === "all" ? false : prev.settingsPending,
    }));
    void dismissV2PluginMigration(target)
      .then((next) => setSnapshot(next))
      .catch(() => undefined);
  }, []);

  return { snapshot, dismiss };
}
