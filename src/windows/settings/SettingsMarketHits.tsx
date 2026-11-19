import { Store } from "lucide-react";
import { useLocale, useTranslation } from "../../i18n";
import { localized } from "./pluginMarketModel";
import type { SearchablePlugin } from "./marketSearch";

export function SettingsMarketHits({ plugins, onOpen }: { plugins: readonly SearchablePlugin[]; onOpen: (plugin: SearchablePlugin) => void }) {
  const text = useTranslation().settings.pluginsV3.marketPage.settingsSearch;
  const { locale } = useLocale();
  return (
    <section className="settings-sidebar__group settings-sidebar__market" aria-label={text.heading} data-market-hits>
      <div className="settings-sidebar__market-title">
        <Store size={16} strokeWidth={2} aria-hidden="true" />
        <span>{text.heading}</span>
      </div>
      <ul className="settings-sidebar__hits">
        {plugins.map((plugin) => {
          const title = localized(plugin.displayName, locale, plugin.name);
          return (
            <li key={plugin.name}>
              <button className="settings-sidebar__hit" type="button" title={text.open(title)} data-market-hit={plugin.name} onClick={() => onOpen(plugin)}>
                <span>{title}</span>
                {plugin.installedVersion ? <em className="settings-sidebar__hit-tag">{text.installed}</em> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
