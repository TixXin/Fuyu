import type { KeyboardEvent, MouseEvent } from "react";

const ROW = ".agent-session, .agent-card";

function rowsOf(list: HTMLElement) {
  return [...list.querySelectorAll<HTMLElement>(`:scope > li[data-session-key]:not(.agent-motion-ghost) :is(${ROW})`)];
}

function openMenu(item: Element | null) {
  item?.querySelector<HTMLButtonElement>(".agent-session__more button")?.click();
}

export function useSessionKeyboard(onArchive: ((key: string) => void) | null) {
  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const target = event.target as HTMLElement;
    if (!target.matches(ROW)) return;
    const item = target.closest<HTMLElement>("li[data-session-key]");
    if (!item) return;
    const plain = !event.ctrlKey && !event.altKey && !event.metaKey;
    if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey && plain)) {
      event.preventDefault();
      openMenu(item);
      return;
    }
    if (!plain || event.shiftKey) return;
    if ((event.key === "Delete" || event.key === "Backspace") && onArchive) {
      event.preventDefault();
      const rows = rowsOf(event.currentTarget);
      const at = rows.indexOf(target);
      (rows[at + 1] ?? rows[at - 1])?.focus();
      onArchive(item.dataset.sessionKey ?? "");
      return;
    }
    const rows = rowsOf(event.currentTarget);
    const at = rows.indexOf(target);
    const next =
      event.key === "ArrowDown" ? Math.min(rows.length - 1, at + 1)
      : event.key === "ArrowUp" ? Math.max(0, at - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? rows.length - 1
      : null;
    if (next === null || at < 0) return;
    event.preventDefault();
    rows[next].focus();
  };

  const onContextMenu = (event: MouseEvent<HTMLUListElement>) => {
    const item = (event.target as Element).closest("li[data-session-key]");
    if (!item?.querySelector(".agent-session__more")) return;
    event.preventDefault();
    openMenu(item);
  };

  return { onKeyDown, onContextMenu };
}
