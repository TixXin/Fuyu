import type { IslandSettings } from "../../../lib/settings/types";
import { ISLAND_SIDE_ROW_HEIGHT } from "../../plugin-kernel/islandContributions";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { devicesInUse } from "../deviceUse";
import { useDeviceUse } from "../useDeviceUse";
import { deviceUseState } from "./islandState";

type RunnerProps = { settings: Pick<IslandSettings, "deviceUseIndicator"> };

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function DeviceUseRunner({ settings }: RunnerProps) {
  const deviceUse = useDeviceUse(settings.deviceUseIndicator);
  deviceUseState.useProvide(deviceUse);
  useIslandContributions("builtin", "device-use.side", devicesInUse(deviceUse).map((device) => ({ kind: "side", item: `device-${device}`, height: ISLAND_SIDE_ROW_HEIGHT })));
  return null;
}

runnerSlot.add({ id: "device-use.runner", component: DeviceUseRunner });
