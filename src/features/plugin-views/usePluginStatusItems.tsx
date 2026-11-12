import { useMemo, type ReactNode } from "react";
import type { PluginViewEntry } from "./api";
import { pluginPageId } from "./model";
import { PluginStatusChip } from "./PluginStatusChip";
import { shownStatusEntries } from "./statusItems";
import { usePluginStatus } from "./usePluginViews";

export const pluginStatusItemId = (pluginId: string, itemId: string) => `plugin:${pluginId}/${itemId}`;

export function usePluginStatusItems(
  views: readonly PluginViewEntry[],
  onOpen: (page: `plugin:${string}`) => void,
): { id: string; node: ReactNode }[] {
  const status = usePluginStatus();
  return useMemo(
    () =>
      shownStatusEntries(status).map((entry) => {
        const view = views.find((candidate) => candidate.pluginId === entry.pluginId);
        const page = view ? pluginPageId(view.pluginId, view.viewId) : null;
        return {
          id: pluginStatusItemId(entry.pluginId, entry.itemId),
          node: <PluginStatusChip status={entry} onOpen={page ? () => onOpen(page) : null} />,
        };
      }),
    [status, views, onOpen],
  );
}
