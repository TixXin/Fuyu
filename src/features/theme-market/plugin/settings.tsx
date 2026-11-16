import { addSettingsCategory } from "../../../windows/settings/slots/categorySlot";
import { buildTheme } from "../../../lib/theme/theme";
import { ThemeMarketPage } from "../ThemeMarketPage";

addSettingsCategory("themeMarket", ({ settings, locale, presets, onSettingsChange }) => (
  <ThemeMarketPage
    settings={settings}
    onSettingsChange={onSettingsChange}
    onSave={(theme, look) => void presets.onImportPreset(JSON.stringify(buildTheme(theme.name[locale], look, new Date())))}
  />
));
