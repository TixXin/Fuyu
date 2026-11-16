import type { ReactNode } from "react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { useTranslation } from "../../i18n";
import { FeatureOffRow, type TakenBy } from "../../windows/settings/ShortcutFeatureOffRow";
import { ScreenshotShortcutRows } from "./ScreenshotShortcutRows";
import type { ScreenshotSettings } from "./settings";

export function ScreenshotShortcutGroup({ title, action, enabled, screenshot, onScreenshotChange, takenBy, onTurnOn }: {
  title: string;
  action: ReactNode;
  enabled: boolean;
  screenshot: ScreenshotSettings;
  onScreenshotChange: (settings: ScreenshotSettings) => void;
  takenBy: TakenBy;
  onTurnOn: () => void;
}) {
  const t = useTranslation();
  return (
    <SettingsGroup title={title} action={action} footer={enabled ? t.settings.screenshot.shortcutsHint : undefined}>
      {enabled
        ? <ScreenshotShortcutRows settings={screenshot} onSettingsChange={onScreenshotChange} takenBy={(shortcut, target) => takenBy(shortcut, `screenshot:${target}`)} />
        : <FeatureOffRow feature={t.settings.categories.screenshot} onTurnOn={onTurnOn} />}
    </SettingsGroup>
  );
}
