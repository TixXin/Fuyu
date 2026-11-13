import { Activity, ArrowUpCircle, LayoutGrid, Search, TriangleAlert, type LucideIcon } from "lucide-react";
import { useTranslation } from "../../i18n";
import { INSTALLED_FILTERS, type InstalledFilter } from "./installedFilter";
import "./PluginToolbar.css";

const ICONS: Record<InstalledFilter, LucideIcon> = {
  all: LayoutGrid,
  running: Activity,
  updates: ArrowUpCircle,
  attention: TriangleAlert,
};

export function InstalledPluginsToolbar({
  query,
  filter,
  counts,
  onQueryChange,
  onFilterChange,
}: {
  query: string;
  filter: InstalledFilter;
  counts: Record<InstalledFilter, number>;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: InstalledFilter) => void;
}) {
  const text = useTranslation().settings.plugins.overview;

  return (
    <div className="plugins-toolbar">
      <label className="plugin-search">
        <Search size={13} strokeWidth={2.4} aria-hidden="true" />
        <input
          type="search"
          value={query}
          placeholder={text.search}
          aria-label={text.search}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          onKeyDown={(event) => event.key === "Escape" && query && (event.preventDefault(), onQueryChange(""))}
        />
      </label>
      <div className="plugins-toolbar__filters" role="group" aria-label={text.filterLabel}>
        {INSTALLED_FILTERS.map((name) => {
          const Icon = ICONS[name];
          const empty = counts[name] === 0 && name !== "all";
          return (
            <button
              key={name}
              className={`plugin-chip plugins-toolbar__filter${name === "attention" && counts[name] > 0 ? " plugin-chip--warn" : ""}`}
              type="button"
              data-filter={name}
              aria-pressed={filter === name}
              disabled={empty && filter !== name}
              onClick={() => onFilterChange(filter === name ? "all" : name)}
            >
              <Icon size={12} strokeWidth={2.4} aria-hidden="true" />
              <span>{text.filter[name]}</span>
              <span className="plugin-chip__count">{counts[name]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
