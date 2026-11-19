import { Store } from "lucide-react";
import { useTranslation } from "../../i18n";
import { InstalledPluginRow, type RowAction } from "./InstalledPluginRow";
import { countEntries, matchesEntry, type InstalledEntry, type InstalledFilter } from "./pluginEntries";
import type { PluginDetailTab } from "./pluginPageHandoff";
import { PluginSearchInput } from "./PluginSearchInput";

const FILTERS: readonly InstalledFilter[] = ["all", "on", "off", "attention"];
export const SEARCH_FROM = 6;

export function visibleFilters(counts: Record<InstalledFilter, number>): InstalledFilter[] {
  if (counts.all < SEARCH_FROM) return counts.attention > 0 ? ["attention"] : [];
  return FILTERS.filter((key) => key === "all" || counts[key] > 0);
}

export function InstalledPluginList({ entries, stale, query, filter, onQuery, onFilter, onOpen, onAction, onSearchMarket }: {
  entries: readonly InstalledEntry[];
  stale: boolean;
  query: string;
  filter: InstalledFilter;
  onQuery: (next: string) => void;
  onFilter: (next: InstalledFilter) => void;
  onOpen: (entry: InstalledEntry, tab?: PluginDetailTab) => void;
  onAction: (entry: InstalledEntry, action: RowAction) => void;
  onSearchMarket: () => void;
}) {
  const text = useTranslation().settings.pluginsV3.page;
  const counts = countEntries(entries);
  const active: InstalledFilter = counts[filter] === 0 ? "all" : filter;
  const searchable = counts.all >= SEARCH_FROM;
  const filters = visibleFilters(counts);
  const shown = entries.filter((entry) => matchesEntry(entry, active, searchable ? query : ""));
  const running = entries.filter((entry) => entry.status.dot === "ok").length;
  const needSetup = entries.filter((entry) => entry.setup).length;
  return (
    <>
      <div className="plugin-page__summary" data-summary>
        <b>{text.summary.installed(counts.all)}</b>
        {stale ? null : <span><i className="plugin-page__dot plugin-page__dot--ok" />{text.summary.running(running)}</span>}
        {counts.off > 0 ? <span><i className="plugin-page__dot plugin-page__dot--off" />{text.summary.off(counts.off)}</span> : null}
        {needSetup > 0 ? <span data-summary-setup><i className="plugin-page__dot plugin-page__dot--setup" />{text.summary.setup(needSetup)}</span> : null}
        {counts.attention > 0 ? <span className="plugin-page__summary-warn"><i className="plugin-page__dot plugin-page__dot--warn" />{text.summary.attention(counts.attention)}</span> : null}
      </div>
      {searchable || filters.length > 0 ? (
        <div className="plugin-page__toolbar">
          {searchable ? <PluginSearchInput query={query} placeholder={text.search} clearLabel={text.clearSearch} onChange={onQuery} /> : null}
          <div className="plugin-page__filters" role="group" aria-label={text.filtersLabel}>
            {filters.map((key) => (
              <button
                key={key}
                className={`plugin-chip${key === "attention" ? " plugin-chip--warn" : ""}`}
                type="button"
                aria-pressed={active === key}
                data-filter={key}
                onClick={() => onFilter(active === key && key !== "all" ? "all" : key)}
              >
                {text.filters[key]}
                <span className="plugin-chip__count">{counts[key]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {shown.length > 0 ? (
        <div className={`plugin-list${stale ? " plugin-list--stale" : ""}`}>
          {shown.map((entry) => (
            <InstalledPluginRow
              key={entry.id}
              entry={entry}
              stale={stale}
              onOpen={(tab) => onOpen(entry, tab)}
              onAction={(action) => onAction(entry, action)}
            />
          ))}
        </div>
      ) : (
        <div className="plugin-card plugin-empty plugin-empty--compact" data-no-match>
          <p>{text.noMatch(query.trim())}</p>
          <div className="plugin-empty__actions">
            <button className="plugin-btn" type="button" onClick={() => onQuery("")}>{text.clearSearch}</button>
            <button className="plugin-btn" type="button" data-action="search-market" onClick={onSearchMarket}>
              <Store size={13} strokeWidth={2.2} aria-hidden="true" />
              {text.searchMarket}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
