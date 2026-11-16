import { useTranslation } from "../../../i18n";
import { settingsRunners, type SettingsRunnerProps } from "../../plugin-kernel/settingsSlots";
import { useReportShortcutOwners } from "../../../lib/shortcut/useReportShortcutOwners";
import { SHORTCUT_ACTIONS } from "../settings";
import { useScreenshotSettings } from "../useScreenshotSettings";
import type { ComponentProps, ComponentType } from "react";
import { addSettingsCategory } from "../../plugin-kernel/settingsCategories";
import { FeaturePageLink } from "../../../components/settings/FeaturePageLink";
import { shortcutSections, type ShortcutsSectionProps } from "../../plugin-kernel/settingsSlots";
import { ScreenshotSettingsPage } from "../ScreenshotSettingsPage";
import { ScreenshotShortcutGroup } from "../ScreenshotShortcutGroup";
import type { IslandSettings } from "../../../lib/settings/types";

type PageProps = {
  settings: IslandSettings;
  onSettingsChange(settings: IslandSettings): void;
  onOpenShortcuts(): void;
};

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

settingsRunners.add({ id: "screenshot.shortcut-owners", component: ScreenshotShortcutOwners });

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

const screenshotPage = (tab: ComponentProps<typeof ScreenshotSettingsPage>["tab"]): ComponentType<PageProps> =>
  function ScreenshotPage({ settings, onSettingsChange, onOpenShortcuts }) {
    return <ScreenshotSettingsPage tab={tab} settings={settings} onSettingsChange={onSettingsChange} onOpenShortcuts={onOpenShortcuts} />;
  };

addSettingsCategory("screenshot", screenshotPage("screenshot"));
addSettingsCategory("screenshotRecord", screenshotPage("screenshotRecord"));
