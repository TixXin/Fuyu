import type { PluginMenu } from "./api";

export function menuTarget(element: Element): { menu: PluginMenu; itemId: string } | null {
  const rows: [string, string, PluginMenu][] = [
    [".todo-list [data-todo-id]", "data-todo-id", "todo/context"],
    ["[data-clipboard-id]", "data-clipboard-id", "clipboard/context"],
    ["[data-shelf-id]", "data-shelf-id", "shelf/context"],
    ["[data-message-id]", "data-message-id", "message/context"],
    ["[data-mail-id]", "data-mail-id", "message/context"],
  ];
  for (const [selector, attribute, menu] of rows) {
    const itemId = element.closest(selector)?.getAttribute(attribute);
    if (itemId) return { menu, itemId };
  }
  return null;
}
