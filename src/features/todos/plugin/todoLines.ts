import type { Translations } from "../../../i18n";
import { ISLAND_SIDE_ROW_HEIGHT, LINE_PRIORITY, type IslandContribution } from "../../plugin-kernel/islandContributions";
import type { TodoLine } from "./islandState";

export type TodoRanks = { todoTitle: number | null; todoCount: number | null };

const DEFAULT_RANKS: TodoRanks = { todoTitle: LINE_PRIORITY.todoTitle, todoCount: LINE_PRIORITY.todoCount };

export function todoLineContributions({ title, count }: TodoLine, t: Translations, ranks: TodoRanks = DEFAULT_RANKS): IslandContribution[] {
  const list: IslandContribution[] = [];
  if (title !== null && ranks.todoTitle !== null) list.push({ kind: "line", item: "todos.title", priority: ranks.todoTitle, measure: title, label: t.messages.collapsedTask(title) });
  if (count !== null && ranks.todoCount !== null) list.push({ kind: "line", item: "todos.count", priority: ranks.todoCount, measure: t.island.pendingTodos(count), center: true, label: t.island.pendingTodos(count) });
  if (count !== null && count > 0) list.push({ kind: "side", item: "todo", height: ISLAND_SIDE_ROW_HEIGHT });
  return list;
}
