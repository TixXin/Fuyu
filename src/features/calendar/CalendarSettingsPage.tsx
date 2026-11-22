import type { IslandSettings } from "../../lib/settings/types";
import { FeatureHeader } from "../../components/settings/FeatureHeader";
import { SlotView } from "../plugin-kernel/SlotView";
import { settingsCategoryIcon } from "../plugin-kernel/settingsCategories";
import { settingsSections } from "../plugin-kernel/settingsSlots";
import { CalendarAlertsSection } from "./CalendarAlertsSection";
import { CalendarCountdownSection } from "./CalendarCountdownSection";
import { CalendarDemoSection } from "./CalendarDemoSection";
import { CalendarFilterSection } from "./CalendarFilterSection";
import { CalendarPanelPrefsSection } from "./CalendarPanelPrefsSection";
import { CalendarSourcesSection } from "./CalendarSourcesSection";

type CalendarSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
};

export type CalendarSettingsTab = "calendar" | "calendarAlerts";

const sections = settingsSections<CalendarSectionProps, CalendarSettingsTab>();

sections.add({ id: "calendar.sources", category: "calendar", order: 10, component: CalendarSourcesSection });
sections.add({ id: "calendar.panel", category: "calendar", order: 20, component: CalendarPanelPrefsSection });
sections.add({ id: "calendar.filters", category: "calendar", order: 30, component: CalendarFilterSection });
sections.add({ id: "calendarAlerts.demo", category: "calendarAlerts", order: 10, component: CalendarDemoSection });
sections.add({ id: "calendarAlerts.countdown", category: "calendarAlerts", order: 20, component: CalendarCountdownSection });
sections.add({ id: "calendarAlerts.banner", category: "calendarAlerts", order: 30, component: CalendarAlertsSection });

export function CalendarSettingsPage({ tab, ...props }: CalendarSectionProps & { tab: CalendarSettingsTab }) {
  return (
    <>
      <FeatureHeader feature="calendar" icon={settingsCategoryIcon("calendar")} />
      <SlotView slot={sections} group={tab} props={props} />
    </>
  );
}
