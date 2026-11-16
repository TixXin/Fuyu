import { useTranslation } from "../../../i18n";
import { runnerSlot, type SettingsRunnerProps } from "../../../windows/settings/slots/runnerSlot";
import { useReportShortcutOwners } from "../../../windows/settings/useReportShortcutOwners";
import { SHORTCUT_ACTIONS } from "../settings";
import { useScreenshotSettings } from "../useScreenshotSettings";
import type { ComponentProps, ComponentType } from "react";
import { addSettingsCategory, type SettingsPageProps } from "../../../windows/settings/slots/categorySlot";
import { FeaturePageLink } from "../../../windows/settings/FeaturePageLink";
import { shortcutSections, type ShortcutsSectionProps } from "../../../windows/settings/slots/shortcutSlots";
import { ScreenshotSettingsPage } from "../ScreenshotSettingsPage";
import { ScreenshotShortcutGroup } from "../ScreenshotShortcutGroup";

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

function ScreenshotShortcutsSection({ settings, onSettingsChange, onOpenPage, takenBy }: ShortcutsSectionProps) {
  const t = useTranslation();
  const [screenshot, setScreenshot] = useScreenshotSettings();
  return (
    <ScreenshotShortcutGroup
      title={t.settings.categories.screenshot}
      action={<FeaturePageLink page="screenshot" onOpenPage={onOpenPage} />}
      enabled={settings.screenshotEnabled}
      screenshot={screenshot}
      onScreenshotChange={setScreenshot}
      takenBy={takenBy}
      onTurnOn={() => onSettingsChange({ ...settings, screenshotEnabled: true })}
    />
  );
}

shortcutSections.add({ id: "shortcuts.screenshot", category: "shortcuts", order: 30, component: ScreenshotShortcutsSection });

const screenshotPage = (tab: ComponentProps<typeof ScreenshotSettingsPage>["tab"]): ComponentType<SettingsPageProps> =>
  function ScreenshotPage({ settings, onSettingsChange, onOpenShortcuts }) {
    return <ScreenshotSettingsPage tab={tab} settings={settings} onSettingsChange={onSettingsChange} onOpenShortcuts={onOpenShortcuts} />;
  };

addSettingsCategory("screenshot", screenshotPage("screenshot"));
addSettingsCategory("screenshotRecord", screenshotPage("screenshotRecord"));
