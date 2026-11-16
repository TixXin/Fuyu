import { defineSlot, type IslandAlertMeta } from "../../../features/plugin-kernel/slots";

export type NotchAlertSources = object;

export const alertSlot = defineSlot<NotchAlertSources, IslandAlertMeta<NotchAlertSources>>("island.alert/v1");
