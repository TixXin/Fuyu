import { settingsSections } from "../../plugin-kernel/settingsSlots";
import { buildTheme } from "../../../lib/theme/theme";
import { ThemeMarketPage } from "../ThemeMarketPage";
import type { IslandSettings } from "../../../lib/settings/types";
import { useLocale } from "../../../i18n";
import { OWNER } from "./owner.ts";

type SectionProps = {
  settings: IslandSettings;
  presets: { onImportPreset(text: string): unknown };
  onSettingsChange(settings: IslandSettings): void;
};

function ThemeMarketSection({ settings, presets, onSettingsChange }: SectionProps) {
  const { locale } = useLocale();
  return (
    <ThemeMarketPage
      settings={settings}
      onSettingsChange={onSettingsChange}
      onSave={(theme, look) => void presets.onImportPreset(JSON.stringify(buildTheme(theme.name[locale], look, new Date())))}
    />
  );
}

settingsSections<SectionProps, "theme">().add({ id: "theme.market", category: "theme", order: 30, component: ThemeMarketSection }, OWNER);
