import type { QuotaAlert } from "../../features/agent-status/quotaAlerts";
import { useIslandContributions } from "../../features/plugin-kernel/useIslandContributions";

export function useLegacyAlerts({ quotaAlert }: { quotaAlert: QuotaAlert | null }) {
  useIslandContributions("builtin", "legacy.alerts", quotaAlert ? [{ kind: "alert", item: "quota" }] : []);
}
