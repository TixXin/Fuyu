import { ISLAND_SIDE_ROW_HEIGHT } from "../../plugin-kernel/islandContributions";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { devicesInUse } from "../deviceUse";
import { useDeviceUse } from "../useDeviceUse";
import { deviceUseState } from "./islandState";
import { OWNER } from "./owner.ts";

const runnerSlot = defineSlot<object>("island.runner/v1");

function DeviceUseRunner() {
  const deviceUse = useDeviceUse();
  deviceUseState.useProvide(deviceUse);
  useIslandContributions(OWNER, "device-use.side", devicesInUse(deviceUse).map((device) => ({ kind: "side", item: `device-${device}`, height: ISLAND_SIDE_ROW_HEIGHT })));
  return null;
}

runnerSlot.add({ id: "device-use.runner", component: DeviceUseRunner }, OWNER);
