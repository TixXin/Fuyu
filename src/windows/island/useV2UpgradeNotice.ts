import { useCallback, useEffect, useState } from "react";
import { useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import { useV2PluginMigration } from "../../features/plugin-kernel/useV2PluginMigration";
import {
  shouldShowIslandMigrationNotice,
  totalLegacyPlugins,
} from "../../features/plugin-kernel/v2Migration";
import { useTranslation } from "../../i18n";
import type { IslandMode } from "./types";

const SHOW_MS = 10_000;

export function useV2UpgradeNotice({
  mode,
  isTucked,
  quiet,
  demoActive,
}: {
  mode: IslandMode;
  isTucked: boolean;
  quiet: boolean;
  demoActive: boolean;
}) {
  const { busy } = useIslandContributed();
  const { snapshot, dismiss } = useV2PluginMigration();
  const copy = useTranslation().island.v2Migration;
  const [held, setHeld] = useState(false);

  const canShow = mode === "collapsed" && !isTucked && !busy && !quiet && !demoActive;
  const active = canShow && shouldShowIslandMigrationNotice(snapshot);
  const count = totalLegacyPlugins(snapshot);
  const text = active ? copy.notice(count) : null;

  useEffect(() => {
    if (!active || held) return;
    const timer = window.setTimeout(() => dismiss("island"), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [active, held, dismiss]);

  const acknowledge = useCallback(() => {
    dismiss("island");
  }, [dismiss]);

  const hold = useCallback(() => setHeld(true), []);
  const release = useCallback(() => setHeld(false), []);

  return { active, text, acknowledge, hold, release };
}

export type V2UpgradeNoticeController = ReturnType<typeof useV2UpgradeNotice>;
