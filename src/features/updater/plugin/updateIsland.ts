import { useTranslation } from "../../../i18n";
import { useIslandAction, useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { useUpdateReminder } from "../useBackgroundUpdateCheck";
import { OWNER } from "./owner";

export const UPDATE_REMINDER_HINT = "update.reminder";

export function useUpdateContributions(openUpdates: () => void) {
  const t = useTranslation();
  const version = useUpdateReminder();
  useIslandAction("updater.open", openUpdates);
  useIslandContributions(OWNER, "updater.reminder", version ? [
    { kind: "hint", key: UPDATE_REMINDER_HINT },
    { kind: "badge", target: "settings", label: t.settings.project.update.islandReminder(version), action: "updater.open" },
  ] : []);
}
