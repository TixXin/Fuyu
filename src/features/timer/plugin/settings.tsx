import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { useTranslation } from "../../../i18n";
import { useReportShortcutOwners } from "../../../lib/shortcut/useReportShortcutOwners";
import { settingsRunners, settingsSections, shortcutSections, type ShortcutsSectionProps } from "../../plugin-kernel/settingsSlots";
import { BreakRemindersGroup } from "../BreakRemindersGroup";
import { TimerShortcutRow } from "../TimerShortcutRow";
import { TimerSoundGroup } from "../TimerSoundGroup";
import { useTimerConfig } from "../useTimerConfig";
import { OWNER } from "./owner.ts";

const sections = settingsSections<object, "behaviorAlerts">();

sections.add({ id: "behaviorAlerts.timer", category: "behaviorAlerts", order: 30, component: TimerSoundGroup }, OWNER);
sections.add({ id: "behaviorAlerts.breaks", category: "behaviorAlerts", order: 20, component: BreakRemindersGroup }, OWNER);

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
