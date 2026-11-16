import { defineSlot, type IslandCollapsedMeta } from "../../plugin-kernel/slots";
import { DeviceUseIndicator } from "../DeviceUseIndicator";
import { deviceUseState } from "./islandState";
import { OWNER } from "./owner.ts";

const collapsedSlot = defineSlot<object, IslandCollapsedMeta<object>>("island.collapsed/v1");

function DeviceUseItem() {
  return <DeviceUseIndicator deviceUse={deviceUseState.use()} />;
}

collapsedSlot.add({ id: "device-use", order: 40, component: DeviceUseItem }, OWNER);
