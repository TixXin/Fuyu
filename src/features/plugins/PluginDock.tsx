import { Activity, ArrowUpCircle, LayoutGrid, TriangleAlert, type LucideIcon } from "lucide-react";
import { useLocale, useTranslation } from "../../i18n";
import type { PluginInfo } from "./api";
import { INSTALLED_FILTERS, pluginHealth, type InstalledFilter } from "./installedFilter";
import { PluginIcon } from "./PluginIcon";
import "./PluginDock.css";

const ICONS: Record<InstalledFilter, LucideIcon> = {
  all: LayoutGrid,
  running: Activity,
  updates: ArrowUpCircle,
  attention: TriangleAlert,
};

const SHELF_SIZE = 12;

export function PluginDock({
  plugins,
  allowed,
  filter,
  counts,
  onFilterChange,
  onOpen,
}: {
  plugins: PluginInfo[];
  allowed: boolean;
  filter: InstalledFilter;
  counts: Record<InstalledFilter, number>;
  onFilterChange: (filter: InstalledFilter) => void;
  onOpen: (id: string) => void;
}) {
  const t = useTranslation();
  const { locale } = useLocale();
  const text = t.settings.plugins.overview;
  const shelf = plugins.slice(0, SHELF_SIZE);

  return (
    <section className="plugin-dock">
      <div className="plugin-dock__top">
        <div className="plugin-dock__headline">
          <strong>{text.dockTitle(counts.all)}</strong>
          <span>{counts.attention > 0 ? text.dockAttention(counts.running, counts.attention) : text.dockRunning(counts.running)}</span>
        </div>
        <div className="plugin-dock__shelf">
          {shelf.map((plugin) => {
            const name = plugin.name?.[locale] ?? plugin.id;
            const health = pluginHealth(plugin, allowed);
            return (
              <button key={plugin.id} className={`plugin-dock__slot plugin-dock__slot--${health}`} type="button" title={name} aria-label={text.dockOpen(name)} onClick={() => onOpen(plugin.id)}>
                <PluginIcon id={plugin.id} name={name} health={health} />
              </button>
            );
          })}
          {plugins.length > SHELF_SIZE ? <span className="plugin-dock__more">+{plugins.length - SHELF_SIZE}</span> : null}
        </div>
      </div>
      <div className="plugins-toolbar__filters plugin-dock__tiles" role="group" aria-label={text.filterLabel}>
        {INSTALLED_FILTERS.map((name) => {
          const Icon = ICONS[name];
          const empty = counts[name] === 0 && name !== "all";
          return (
            <button
              key={name}
              className={`plugin-chip plugins-toolbar__filter plugin-dock__tile plugin-dock__tile--${name}${name === "attention" && counts[name] > 0 ? " plugin-chip--warn" : ""}`}
              type="button"
              data-filter={name}
              aria-pressed={filter === name}
              disabled={empty && filter !== name}
              onClick={() => onFilterChange(filter === name ? "all" : name)}
            >
              <span className="plugin-dock__tile-icon" aria-hidden="true"><Icon size={14} strokeWidth={2.2} /></span>
              <span className="plugin-chip__count">{counts[name]}</span>
              <span>{text.filter[name]}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
