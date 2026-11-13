import { useTranslation } from "../../i18n";
import { useUnsupportedFeatures } from "../../lib/platform";
import { entryOf, isCategoryAvailable, SETTINGS_TABS, type SettingsCategory, type TabbedCategory } from "./categories";
import "./SettingsTabs.css";

export function SettingsTabs({ category, onCategoryChange }: { category: SettingsCategory; onCategoryChange: (category: SettingsCategory) => void }) {
  const text = useTranslation().settings.categories;
  const unsupported = useUnsupportedFeatures();
  const entry = entryOf(category);
  if (!entry) return null;
  const tabs = SETTINGS_TABS[entry].filter((tab) => isCategoryAvailable(tab, unsupported));
  const move = (from: TabbedCategory, step: number) => {
    const next = tabs[(tabs.indexOf(from) + step + tabs.length) % tabs.length];
    onCategoryChange(next);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`.settings-tabs__tab[data-tab='${next}']`)?.focus());
  };
  return (
    <div className="settings-tabs" role="tablist" aria-label={text.entries[entry]} data-tauri-drag-region>
      {tabs.map((tab) => {
        const active = tab === category;
        return (
          <button
            key={tab}
            className={`settings-tabs__tab${active ? " settings-tabs__tab--active" : ""}`}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            data-tab={tab}
            onClick={() => onCategoryChange(tab)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") move(tab, 1);
              if (event.key === "ArrowLeft") move(tab, -1);
            }}
          >
            {text.tabs[tab]}
          </button>
        );
      })}
    </div>
  );
}
