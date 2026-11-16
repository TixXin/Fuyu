import { useTranslation } from "../../../i18n";
import { runnerSlot, type SettingsRunnerProps } from "../../../windows/settings/slots/runnerSlot";
import { useReportShortcutOwners } from "../../../windows/settings/useReportShortcutOwners";
import { SHORTCUT_ACTIONS } from "../settings";
import { useScreenshotSettings } from "../useScreenshotSettings";

function ScreenshotShortcutOwners({ settings }: SettingsRunnerProps) {
  const t = useTranslation();
  const [screenshot] = useScreenshotSettings();
  useReportShortcutOwners("screenshot", 30, settings.screenshotEnabled
    ? SHORTCUT_ACTIONS.flatMap((action) => {
      const shortcut = screenshot.shortcuts[action];
      return shortcut ? [{ id: `screenshot:${action}`, label: t.settings.screenshot.actions[action], shortcut, home: "screenshot" as const }] : [];
    })
    : []);
  return null;
}

runnerSlot.add({ id: "screenshot.shortcut-owners", component: ScreenshotShortcutOwners });
