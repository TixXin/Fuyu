import type { Translations } from "../../../i18n";
import { ISLAND_SIDE_ROW_HEIGHT, LINE_PRIORITY, type IslandContribution } from "../../plugin-kernel/islandContributions";
import type { TodoLine } from "./islandState";

export function todoLineContributions({ title, count }: TodoLine, t: Translations): IslandContribution[] {
  const list: IslandContribution[] = [];
  if (title !== null) list.push({ kind: "line", item: "todos.title", priority: LINE_PRIORITY.todoTitle, measure: title, label: t.messages.collapsedTask(title) });
  if (count !== null) list.push({ kind: "line", item: "todos.count", priority: LINE_PRIORITY.todoCount, measure: t.island.pendingTodos(count), center: true, label: t.island.pendingTodos(count) });
  if (count !== null && count > 0) list.push({ kind: "side", item: "todo", height: ISLAND_SIDE_ROW_HEIGHT });
  return list;
}
