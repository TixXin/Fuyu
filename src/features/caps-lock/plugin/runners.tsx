import { useMemo } from "react";
import type { IslandContribution } from "../../plugin-kernel/islandContributions";
import { defineSlot } from "../../plugin-kernel/slots";
import { useBuiltinConfig } from "../../plugin-kernel/useBuiltinPlugins";
import { useIslandContributed, useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { readCapsLockConfig, showsBadge } from "../capsLockConfig.ts";
import { useCapsLock } from "../useCapsLock";
import { CAPS_LOCK_BADGE_HINT, capsLockState } from "./islandState";
import { OWNER } from "./owner.ts";

type RunnerProps = {
  mode: string;
  isTucked: boolean;
  quiet: boolean;
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");
const NONE: readonly IslandContribution[] = [];
const ALERT: IslandContribution = { kind: "alert", item: "caps-lock" };
const BADGE: IslandContribution = { kind: "hint", key: CAPS_LOCK_BADGE_HINT };

function CapsLockRunner({ mode, isTucked, quiet }: RunnerProps) {
  const raw = useBuiltinConfig(OWNER);
  const config = useMemo(() => readCapsLockConfig(raw), [raw]);
  const messaging = useIslandContributed((state) => state.preview !== null);
  const { on, alert } = useCapsLock(config, !quiet && mode === "collapsed" && !isTucked);
  const shown = messaging ? null : alert;
  const badge = showsBadge(on, config);
  const view = useMemo(() => ({ alert: shown, badge, badgeClick: config.badgeClick }), [shown, badge, config.badgeClick]);
  capsLockState.useProvide(view);
  const contributions = useMemo(() => (shown || badge ? [...(shown ? [ALERT] : []), ...(badge ? [BADGE] : [])] : NONE), [shown, badge]);
  useIslandContributions(OWNER, "caps-lock.alert", contributions);
  return null;
}

runnerSlot.add({ id: "caps-lock.alert", component: CapsLockRunner }, OWNER);
