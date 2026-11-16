import type { ComponentProps } from "react";
import { defineSlot, type IslandCollapsedMeta } from "../../plugin-kernel/slots";
import { DeviceUseIndicator } from "../DeviceUseIndicator";

type CollapsedContext = ComponentProps<typeof DeviceUseIndicator>;

const collapsedSlot = defineSlot<CollapsedContext, IslandCollapsedMeta<CollapsedContext>>("island.collapsed/v1");

collapsedSlot.add({ id: "device-use", order: 40, component: DeviceUseIndicator });
