import { addSettingsCategory } from "../../plugin-kernel/settingsCategories";
import { ShelfSettingsPage } from "../ShelfSettingsPage";
import type { IslandSettings } from "../../../lib/settings/types";

type PageProps = {
  settings: IslandSettings;
  onSettingsChange(settings: IslandSettings): void;
};

addSettingsCategory("shelf", ({ settings, onSettingsChange }: PageProps) => <ShelfSettingsPage settings={settings} onSettingsChange={onSettingsChange} />);
