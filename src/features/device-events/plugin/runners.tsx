import type { IslandSettings } from "../../../lib/settings/types";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { useDeviceAlert } from "../useDeviceAlert";
import { deviceAlertState } from "./islandState";

type RunnerProps = {
  mode: string;
  isTucked: boolean;
  quiet: boolean;
  settings: Pick<IslandSettings, "deviceAlerts">;
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function DeviceAlerts({ mode, isTucked, quiet, settings }: RunnerProps) {
  const alert = useDeviceAlert(settings.deviceAlerts, !quiet && mode === "collapsed" && !isTucked);
  deviceAlertState.useProvide(alert);
  useIslandContributions("builtin", "device-events.alert", alert ? [{ kind: "alert", item: "device" }] : []);
  return null;
}

runnerSlot.add({ id: "device-events.alert", component: DeviceAlerts });
