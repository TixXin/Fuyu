import type { PluginStatusEntry } from "./api";

export function shownStatusEntries(entries: readonly PluginStatusEntry[]): PluginStatusEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.text)
    .sort((left, right) => right.entry.priority - left.entry.priority || left.index - right.index)
    .map(({ entry }) => entry);
}
