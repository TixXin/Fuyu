import { addSettingsCategory } from "../../plugin-kernel/settingsCategories";
import { buildTheme } from "../../../lib/theme/theme";
import { ThemeMarketPage } from "../ThemeMarketPage";
import type { IslandSettings } from "../../../lib/settings/types";
import type { LocaleCode } from "../../../i18n";

type PageProps = {
  settings: IslandSettings;
  locale: LocaleCode;
  presets: { onImportPreset(text: string): unknown };
  onSettingsChange(settings: IslandSettings): void;
};

addSettingsCategory("themeMarket", ({ settings, locale, presets, onSettingsChange }: PageProps) => (
  <ThemeMarketPage
    settings={settings}
    onSettingsChange={onSettingsChange}
    onSave={(theme, look) => void presets.onImportPreset(JSON.stringify(buildTheme(theme.name[locale], look, new Date())))}
  />
));
