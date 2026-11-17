import { addSettingsCategory } from "../../plugin-kernel/settingsCategories";
import { CalendarSettingsPage } from "../CalendarSettingsPage";
import type { IslandSettings } from "../../../lib/settings/types";
import { OWNER } from "./owner.ts";

type PageProps = {
  settings: IslandSettings;
  onSettingsChange(settings: IslandSettings): void;
};

addSettingsCategory("calendar", ({ settings, onSettingsChange }: PageProps) => <CalendarSettingsPage settings={settings} onSettingsChange={onSettingsChange} />, OWNER);
