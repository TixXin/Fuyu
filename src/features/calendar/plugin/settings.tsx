import { addSettingsCategory } from "../../plugin-kernel/settingsCategories";
import { CalendarSettingsPage } from "../CalendarSettingsPage";
import type { IslandSettings } from "../../../lib/settings/types";
import { OWNER } from "./owner.ts";

type PageProps = {
  settings: IslandSettings;
  onSettingsChange(settings: IslandSettings): void;
};

const calendarPage = (tab: "calendar" | "calendarSources") =>
  function CalendarPage({ settings, onSettingsChange }: PageProps) {
    return <CalendarSettingsPage tab={tab} settings={settings} onSettingsChange={onSettingsChange} />;
  };

addSettingsCategory("calendar", calendarPage("calendar"), OWNER);
addSettingsCategory("calendarSources", calendarPage("calendarSources"), OWNER);
