import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { useTranslation } from "../../../i18n";
import { useReportShortcutOwners } from "../../../lib/shortcut/useReportShortcutOwners";
import { addSettingsCategory } from "../../plugin-kernel/settingsCategories";
import { settingsRunners, shortcutSections, type ShortcutsSectionProps } from "../../plugin-kernel/settingsSlots";
import { BreakRemindersGroup } from "../BreakRemindersGroup";
import { TimerShortcutRow } from "../TimerShortcutRow";
import { TimerSoundGroup } from "../TimerSoundGroup";
import { useTimerConfig } from "../useTimerConfig";
import { OWNER } from "./owner.ts";

addSettingsCategory("timerAlerts", () => (
  <>
    <TimerSoundGroup />
    <BreakRemindersGroup />
  </>
), OWNER);

function TimerShortcutOwners() {
  const t = useTranslation();
  const [{ shortcut }] = useTimerConfig();
  useReportShortcutOwners("timer", 45, shortcut ? [{ id: "timer", label: `${t.timer.settings.shortcut} · ${t.timer.settings.title}`, shortcut }] : []);
  return null;
}

settingsRunners.add({ id: "timer.shortcut-owners", component: TimerShortcutOwners }, OWNER);

function TimerShortcutsSection({ takenBy }: ShortcutsSectionProps) {
  const text = useTranslation().timer.settings;
  const [{ shortcut }, update] = useTimerConfig();
  return (
    <SettingsGroup title={text.title} footer={text.shortcutHint}>
      <TimerShortcutRow shortcut={shortcut} takenBy={(next) => takenBy(next, "timer")} onChange={(next) => update("shortcut", next)} />
    </SettingsGroup>
  );
}

shortcutSections.add({ id: "shortcuts.timer", category: "shortcuts", order: 40, component: TimerShortcutsSection }, OWNER);
