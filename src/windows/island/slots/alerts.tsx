import type { QuotaAlert } from "../../../features/agent-status/quotaAlerts";
import { defineSlot, type IslandAlertMeta } from "../../../features/plugin-kernel/slots";

export type NotchAlertSources = {
  quotaAlert: QuotaAlert | null;
};

export const alertSlot = defineSlot<NotchAlertSources, IslandAlertMeta<NotchAlertSources>>("island.alert/v1");
