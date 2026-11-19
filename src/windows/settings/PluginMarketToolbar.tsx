import type { PluginMarketSort } from "../../i18n/sections/settings/pluginMarket";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { useTranslation } from "../../i18n";
import type { CategoryCount } from "./pluginMarketModel";
import { PluginSearchInput } from "./PluginSearchInput";

const SORTS: readonly PluginMarketSort[] = ["recommended", "recent"];

export function PluginMarketToolbar({ query, category, sort, total, categories, categoryName, disabled = false, onQuery, onCategory, onSort }: {
  query: string;
  category: string | null;
  sort: PluginMarketSort;
  total: number;
  categories: readonly CategoryCount[];
  categoryName: (id: string) => string;
  disabled?: boolean;
  onQuery: (next: string) => void;
  onCategory: (next: string | null) => void;
  onSort: (next: PluginMarketSort) => void;
}) {
  const text = useTranslation().settings.pluginsV3.marketPage;
  const chip = (id: string | null, label: string, count: number) => (
    <button key={id ?? "all"} className="plugin-chip" type="button" aria-pressed={!query && category === id} disabled={disabled} data-market-category={id ?? "all"} onClick={() => onCategory(id)}>
      {label}
      <span className="plugin-chip__count">{count}</span>
    </button>
  );
  return (
    <div className="market-toolbar">
      <div className="market-toolbar__search">
        <PluginSearchInput query={query} placeholder={text.search} clearLabel={text.clearSearch} disabled={disabled} onChange={onQuery} />
      </div>
      <div className="market-toolbar__row">
        <div className="market-toolbar__cats" role="group" aria-label={text.categoriesLabel}>
          {chip(null, text.allCategories, total)}
          {categories.map((item) => chip(item.id, categoryName(item.id), item.count))}
        </div>
        <SettingsSelect value={sort} ariaLabel={text.sortLabel} disabled={disabled} options={SORTS.map((value) => ({ value, label: text.sort[value] }))} onChange={onSort} />
      </div>
    </div>
  );
}
