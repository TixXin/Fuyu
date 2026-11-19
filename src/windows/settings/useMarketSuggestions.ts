import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { usePinyin } from "../../lib/pinyin/usePinyin";
import { marketClient } from "./pluginMarketActions";
import { categoryNameMap } from "./pluginMarketModel";
import { marketSuggestions, queryWantsPinyin, type SearchablePlugin } from "./marketSearch";

const FRESH_MS = 60 * 1000;
const NONE: readonly SearchablePlugin[] = [];

let cached: { plugins: readonly SearchablePlugin[]; at: number } | null = null;

export function useMarketSuggestions(query: string, settingsResults: number): readonly SearchablePlugin[] {
  const categories = useTranslation().settings.pluginsV3.marketPage.categories;
  const searching = query.trim() !== "";
  const [plugins, setPlugins] = useState<readonly SearchablePlugin[]>(() => cached?.plugins ?? NONE);
  useEffect(() => {
    if (!searching || (cached && Date.now() - cached.at < FRESH_MS)) return;
    let cancelled = false;
    void marketClient
      .catalog()
      .then((snapshot) => {
        cached = { plugins: snapshot.plugins, at: Date.now() };
        if (!cancelled) setPlugins(snapshot.plugins);
      })
      .catch(() => {
        cached = null;
        if (!cancelled) setPlugins(NONE);
      });
    return () => {
      cancelled = true;
    };
  }, [searching]);
  const pinyin = usePinyin(searching && plugins.length > 0 && queryWantsPinyin(query));
  if (!searching || plugins.length === 0) return NONE;
  return marketSuggestions(plugins, query, settingsResults, categoryNameMap(plugins, (id) => categories[id] ?? id), pinyin);
}
