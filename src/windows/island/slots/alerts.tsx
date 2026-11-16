import type { QuotaAlert } from "../../../features/agent-status/quotaAlerts";
import type { DeviceAlert } from "../../../features/device-events/api";
import type { LevelChange } from "../../../features/system-levels/api";
import { defineSlot, type IslandAlertMeta } from "../../../features/plugin-kernel/slots";

export type NotchAlertSources = {
  deviceAlert: DeviceAlert | null;
  quotaAlert: QuotaAlert | null;
  levelPopup: LevelChange | null;
};

export const alertSlot = defineSlot<NotchAlertSources, IslandAlertMeta<NotchAlertSources>>("island.alert/v1");
