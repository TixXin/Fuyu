import { FeaturePageLink } from "../../../components/settings/FeaturePageLink";
import { useTranslation } from "../../../i18n";
import type { IslandSettings } from "../../../lib/settings/types";
import { useReportShortcutOwners } from "../../../lib/shortcut/useReportShortcutOwners";
import { useShortcutOwners } from "../../../lib/shortcut/useShortcutOwners";
import { isBuiltinEnabled, switchBuiltinPlugin } from "../../plugin-kernel/builtinSwitches";
import { addSettingsCategory } from "../../plugin-kernel/settingsCategories";
import { settingsRunners, settingsSections, shortcutSections, type SettingsRunnerProps, type ShortcutsSectionProps } from "../../plugin-kernel/settingsSlots";
import { useBuiltinPlugins } from "../../plugin-kernel/useBuiltinPlugins";
import { CalendarSettingsPage } from "../CalendarSettingsPage";
import { CalendarShortcutSection } from "../CalendarShortcutSection";
import { useCalendarJoinShortcut } from "../useCalendarShortcut";
import { OWNER } from "./owner.ts";

type PageProps = {
  settings: IslandSettings;
  onSettingsChange(settings: IslandSettings): void;
};

type CalendarSectionProps = {
  settings: IslandSettings;
};

function CalendarShortcutOwners({ settings }: SettingsRunnerProps) {
  const t = useTranslation();
  const plugins = useBuiltinPlugins();
  const [shortcut] = useCalendarJoinShortcut();
  const enabled = isBuiltinEnabled(plugins, OWNER, settings.calendarEnabled);
  useReportShortcutOwners(
    "calendar",
    44,
    enabled && shortcut ? [{ id: "calendarJoin", label: t.settings.shortcuts.calendarJoinMeeting, shortcut, home: "calendar" }] : [],
  );
  return null;
}

function CalendarPageShortcutSection({ settings }: CalendarSectionProps) {
  const { takenBy } = useShortcutOwners(settings);
  return <CalendarShortcutSection takenBy={(next) => takenBy(next, "calendarJoin")} />;
}

function CalendarShortcutsPageSection({ settings, onSettingsChange, onOpenPage, takenBy }: ShortcutsSectionProps) {
  const t = useTranslation();
  const plugins = useBuiltinPlugins();
  const enabled = isBuiltinEnabled(plugins, OWNER, settings.calendarEnabled);
  return (
    <CalendarShortcutSection
      title={t.settings.categories.calendar}
      action={<FeaturePageLink page="calendar" onOpenPage={onOpenPage} />}
      enabled={enabled}
      takenBy={(next) => takenBy(next, "calendarJoin")}
      onTurnOn={() => {
        onSettingsChange({ ...settings, calendarEnabled: true });
        void switchBuiltinPlugin(OWNER, true);
      }}
    />
  );
}

const calendarSections = settingsSections<CalendarSectionProps, "calendar">();

addSettingsCategory("calendar", ({ settings, onSettingsChange }: PageProps) => <CalendarSettingsPage settings={settings} onSettingsChange={onSettingsChange} />, OWNER);
calendarSections.add({ id: "calendar.shortcuts", category: "calendar", order: 18, component: CalendarPageShortcutSection }, OWNER);
shortcutSections.add({ id: "shortcuts.calendar", category: "shortcuts", order: 44, component: CalendarShortcutsPageSection }, OWNER);
settingsRunners.add({ id: "calendar.shortcut-owners", component: CalendarShortcutOwners }, OWNER);
