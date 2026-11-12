import { useMemo } from "react";
import type { IslandSettings } from "../../features/appearance/types";
import type { TodoItem } from "../../features/todos/types";
import { useTranslation } from "../../i18n";
import { useTodoRotation } from "./useIslandAutomation";
import { alignCollapsedIslandWidth, getCollapsedIslandWidth } from "./layout";
import type { CollapsedSlots } from "./types";

// Stands in for the agent icon (16px plus gap) when sizing the island for a session title.
const AGENT_ICON_TEXT = "MM";
// Between the centre pattern and the todo count behind it (.island__todo-center).
const TODO_CENTER_GAP = 6;

/**
 * What the collapsed island shows for todos: the active (or rotating) todo
 * title, otherwise the pending count, and the width that text needs. A running
 * agent's session title (`agentTitle`) or a lyric line takes the place of both when given; for
 * lyrics `lyricWidthText` is the song's longest line, so the island keeps one width per song.
 * Filled plugin slots widen the island by the width they declare; the centre slot only while
 * it shows: with no summary text, message preview or translation (`isPeeking`), or in front of
 * the pending count.
 */
export function useCollapsedTodo(
  todos: TodoItem[],
  activeTodoId: string | null,
  settings: IslandSettings,
  isRotationPaused: boolean,
  agentTitle: string | null = null,
  slots: CollapsedSlots = {},
  isPeeking = false,
  lyricWidthText: string | null = null,
) {
  const t = useTranslation();
  const pendingTodoIds = useMemo(
    () => todos.filter((todo) => !todo.completed).map((todo) => todo.id),
    [todos],
  );
  const displayedTodoId = useTodoRotation(
    pendingTodoIds,
    activeTodoId,
    settings.rotateTodos,
    settings.todoRotationSeconds,
    isRotationPaused,
  );
  const collapsedTaskTitle = useMemo(() => {
    const activeTodo = todos.find(
      (todo) => todo.id === displayedTodoId && !todo.completed,
    );
    return activeTodo?.title ?? null;
  }, [displayedTodoId, todos]);
  // "0 todos left" is not worth a hint; with nothing pending the bar shows what it
  // would without a todo count.
  const pendingTodoCount = pendingTodoIds.length;
  const collapsedTodoCount = settings.showIdleTodoCount && !collapsedTaskTitle && pendingTodoCount > 0
    ? pendingTodoCount
    : null;
  const { center, centerWidth = 0, sideWidth = 0, agentIconWidth = 0 } = slots;
  const collapsedIslandWidth = useMemo(() => {
    const text = settings.showCollapsedText
      ? (agentTitle !== null ? AGENT_ICON_TEXT + agentTitle : null) ??
        (lyricWidthText !== null ? AGENT_ICON_TEXT + lyricWidthText : null) ??
        collapsedTaskTitle ?? (collapsedTodoCount !== null
        ? t.island.pendingTodos(collapsedTodoCount)
        : settings.showTitle ? t.island.appName : "")
      : "";
    const iconWidth = settings.showCollapsedText && agentTitle !== null ? agentIconWidth : 0;
    // The same conditions as on the collapsed bar: the centre slot, or the pattern before the count.
    const countShown = settings.showCollapsedText && agentTitle === null && lyricWidthText === null
      && collapsedTaskTitle === null && collapsedTodoCount !== null;
    const patternWidth = !center ? 0 : countShown ? centerWidth + TODO_CENTER_GAP : text === "" && !isPeeking ? centerWidth : 0;
    const extraWidth = sideWidth + iconWidth + patternWidth;
    return alignCollapsedIslandWidth(
      getCollapsedIslandWidth(text, extraWidth, settings.collapsedWidthExtra),
      window.innerWidth,
      window.devicePixelRatio,
      settings.collapsedWidthExtra,
    );
  }, [agentIconWidth, agentTitle, lyricWidthText, center, centerWidth, collapsedTaskTitle, collapsedTodoCount, isPeeking, settings.collapsedWidthExtra, settings.showCollapsedText, settings.showTitle, sideWidth, t]);

  return { collapsedTaskTitle, collapsedTodoCount, collapsedIslandWidth };
}
