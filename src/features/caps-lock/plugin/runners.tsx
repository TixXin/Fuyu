import { useEffect, useMemo, useRef } from "react";
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
  tuckIsland: () => void;
  revealIsland: () => void;
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");
const NONE: readonly IslandContribution[] = [];
const ALERT: IslandContribution = { kind: "alert", item: "caps-lock" };
const BADGE: IslandContribution = { kind: "hint", key: CAPS_LOCK_BADGE_HINT };
const BADGE_STYLE: IslandContribution = { kind: "style", className: "stage--caps-lock-badge" };
const REVEAL_PAUSE: IslandContribution = { kind: "reveal", pauseIdle: true };

function CapsLockRunner({ mode, isTucked, quiet, tuckIsland, revealIsland }: RunnerProps) {
  const raw = useBuiltinConfig(OWNER);
  const config = useMemo(() => readCapsLockConfig(raw), [raw]);
  const messaging = useIslandContributed((state) => state.preview !== null);
  const expanded = mode === "expanded";
  const { on, alert } = useCapsLock(config, !quiet, !expanded);
  const shown = messaging ? null : alert;
  const collapsedAlert = !expanded ? shown : null;
  const badge = showsBadge(on, config);
  const revealedForAlertRef = useRef(false);

  useEffect(() => {
    if (collapsedAlert && isTucked && !quiet) {
      revealedForAlertRef.current = true;
      revealIsland();
    } else if (!collapsedAlert && revealedForAlertRef.current) {
      revealedForAlertRef.current = false;
      if (mode === "collapsed" && !isTucked) tuckIsland();
    }
  }, [collapsedAlert, isTucked, mode, quiet, revealIsland, tuckIsland]);

  useEffect(() => {
    if (expanded) revealedForAlertRef.current = false;
  }, [expanded]);

  const view = useMemo(
    () => ({ expanded, on, alert: shown, badge, badgeClick: config.badgeClick }),
    [expanded, on, shown, badge, config.badgeClick],
  );
  capsLockState.useProvide(view);
  const contributions = useMemo(() => {
    if (!collapsedAlert && !badge) return NONE;
    const list: IslandContribution[] = [];
    if (collapsedAlert) list.push(ALERT, REVEAL_PAUSE);
    if (badge) list.push(BADGE, BADGE_STYLE);
    return list;
  }, [collapsedAlert, badge]);
  useIslandContributions(OWNER, "caps-lock.alert", contributions);
  return null;
}

runnerSlot.add({ id: "caps-lock.alert", component: CapsLockRunner }, OWNER);
