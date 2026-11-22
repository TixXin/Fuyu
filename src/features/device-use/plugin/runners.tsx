import { GLOW_PRIORITY, ISLAND_SIDE_ROW_HEIGHT, type IslandContribution } from "../../plugin-kernel/islandContributions";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { devicesInUse } from "../deviceUse";
import { useDeviceUse } from "../useDeviceUse";
import { deviceUseState } from "./islandState";
import { OWNER } from "./owner.ts";

const runnerSlot = defineSlot<object>("island.runner/v1");

const GLOW_COLORS = { camera: "#30d158", microphone: "#ff9f0a" } as const;

function DeviceUseRunner() {
  const deviceUse = useDeviceUse();
  deviceUseState.useProvide(deviceUse);
  const devices = devicesInUse(deviceUse);
  const list: IslandContribution[] = devices.map((device) => ({ kind: "side", item: `device-${device}`, height: ISLAND_SIDE_ROW_HEIGHT }));
  for (const device of devices) list.push({ kind: "glow", color: GLOW_COLORS[device], priority: GLOW_PRIORITY[device], reason: `device-use.${device}` });
  useIslandContributions(OWNER, "device-use.side", list);
  return null;
}

runnerSlot.add({ id: "device-use.runner", component: DeviceUseRunner }, OWNER);
