import type { QuotaAlert } from "../../features/agent-status/quotaAlerts";
import type { DeviceAlert } from "../../features/device-events/api";
import type { IslandContribution } from "../../features/plugin-kernel/islandContributions";
import { useIslandContributions } from "../../features/plugin-kernel/useIslandContributions";
import type { LevelChange } from "../../features/system-levels/api";

type LegacyAlertInput = {
  deviceAlert: DeviceAlert | null;
  quotaAlert: QuotaAlert | null;
  levelPopup: LevelChange | null;
};

export function useLegacyAlerts({ deviceAlert, quotaAlert, levelPopup }: LegacyAlertInput) {
  const list: IslandContribution[] = [];
  if (deviceAlert) list.push({ kind: "alert", item: "device" });
  if (quotaAlert) list.push({ kind: "alert", item: "quota" });
  if (levelPopup) list.push({ kind: "alert", item: "level" });
  useIslandContributions("builtin", "legacy.alerts", list);
}
