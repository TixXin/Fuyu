import { addSettingsCategory } from "../../plugin-kernel/settingsCategories";
import { CalendarSettingsPage } from "../CalendarSettingsPage";
import type { IslandSettings } from "../../../lib/settings/types";

type PageProps = {
  settings: IslandSettings;
  onSettingsChange(settings: IslandSettings): void;
};

addSettingsCategory("calendar", ({ settings, onSettingsChange }: PageProps) => <CalendarSettingsPage settings={settings} onSettingsChange={onSettingsChange} />);
