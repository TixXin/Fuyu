import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { useDeviceAlert } from "../useDeviceAlert";
import { deviceAlertState } from "./islandState";
import { OWNER } from "./owner.ts";

type RunnerProps = {
  mode: string;
  isTucked: boolean;
  quiet: boolean;
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function DeviceAlerts({ mode, isTucked, quiet }: RunnerProps) {
  const alert = useDeviceAlert(!quiet && mode === "collapsed" && !isTucked);
  deviceAlertState.useProvide(alert);
  useIslandContributions(OWNER, "device-events.alert", alert ? [{ kind: "alert", item: "device" }] : []);
  return null;
}

runnerSlot.add({ id: "device-events.alert", component: DeviceAlerts }, OWNER);
