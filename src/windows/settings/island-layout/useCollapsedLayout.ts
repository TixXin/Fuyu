import { useMemo } from "react";
import { useTranslation } from "../../../i18n";
import { HOVER_ONLY_ITEM_ID, needsHoverOnlyGauge, shownUsageProviders, usageItemId } from "../../../features/claude-usage/usageRing";
import { OWNER as CLAUDE_USAGE } from "../../../features/claude-usage/plugin/owner";
import { builtinConfigBoolean, disabledBuiltinIds, isBuiltinEnabled } from "../../../features/plugin-kernel/builtinSwitches";
import { useBuiltinConfig, useBuiltinPlugins } from "../../../features/plugin-kernel/useBuiltinPlugins";
import { arrangeCollapsedItems, filterCollapsedItemEntries } from "../../../lib/settings/collapsedItems";
import { useCollapsedPlacements } from "../../../lib/settings/useCollapsedPlacements";
import { useCollapsedPluginItems } from "../sections/useCollapsedPluginItems";

export type CollapsedLayout = ReturnType<typeof useCollapsedLayout>;

export function useCollapsedLayout() {
  const t = useTranslation();
  const text = t.settings.collapsedItems;
  const hoverOnlyItemName = t.claudeUsage.hoverOnlyItemName;
  const { placements: saved, save } = useCollapsedPlacements();
  const plugins = useBuiltinPlugins();
  const usageOn = isBuiltinEnabled(plugins, CLAUDE_USAGE);
  const usageConfig = useBuiltinConfig(CLAUDE_USAGE);
  const { items: pluginItems, pages: pluginPages } = useCollapsedPluginItems();
  const timerName = t.island.timer;

  const names = useMemo(() => {
    const disabled = disabledBuiltinIds(plugins);
    const mailOn = builtinConfigBoolean(plugins, "messages", "mail") !== false;
    const entries: [string, string][] = [
      ["status-light", text.item.statusLight],
      ["mail", text.item.mail],
      ["update", text.item.update],
    ];
    entries.push(["device-use", text.item.deviceUse], ["shelf", text.item.shelf], ["music", text.item.music]);
    if (usageOn) {
      for (const provider of shownUsageProviders(usageConfig)) entries.push([usageItemId(provider), text.item.usage(provider.name)]);
      if (needsHoverOnlyGauge(usageConfig)) entries.push([HOVER_ONLY_ITEM_ID, text.item.usage(hoverOnlyItemName)]);
    }
    entries.push(["timer", timerName], ["session-count", text.item.sessionCount]);
    const builtin = new Map(filterCollapsedItemEntries(entries, disabled, mailOn));
    for (const [id, name] of pluginItems) if (!builtin.has(id)) builtin.set(id, name);
    return builtin;
  }, [hoverOnlyItemName, pluginItems, plugins, text, timerName, usageOn, usageConfig]);

  const listed = useMemo(() => [...names.keys()], [names]);
  const placements = useMemo(() => arrangeCollapsedItems(listed, saved), [listed, saved]);
  return { names, listed, placements, saved, save, pluginPages };
}
