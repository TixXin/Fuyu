import { useMemo } from "react";
import type { IslandSettings } from "../../features/appearance/types";
import type { TodoItem } from "../../features/todos/types";
import { useTranslation } from "../../i18n";
import { useTodoRotation } from "./useIslandAutomation";
import { alignCollapsedIslandWidth, getCollapsedIslandWidth, getNoticeIslandWidth } from "./layout";
import type { CollapsedSlots } from "./types";

const AGENT_ICON_TEXT = "MM";
const TODO_CENTER_GAP = 6;
const NOTICE_EXTRA_WIDTH = 180;

export function useCollapsedTodo(
  todos: TodoItem[],
  activeTodoId: string | null,
  settings: IslandSettings,
  isRotationPaused: boolean,
  agentTitle: string | null = null,
  slots: CollapsedSlots = {},
  isPeeking = false,
  lyricWidthText: string | null = null,
  noticeText: string | null = null,
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
  const pendingTodoCount = pendingTodoIds.length;
  const collapsedTodoCount = settings.showIdleTodoCount && !collapsedTaskTitle && pendingTodoCount > 0
    ? pendingTodoCount
    : null;
  const { center, centerWidth = 0, sideWidth = 0, agentIconWidth = 0 } = slots;
  const collapsedIslandWidth = useMemo(() => {
    if (noticeText !== null) {
      return alignCollapsedIslandWidth(
        getNoticeIslandWidth(noticeText, sideWidth + NOTICE_EXTRA_WIDTH, settings.collapsedWidthExtra),
        window.innerWidth,
        window.devicePixelRatio,
        settings.collapsedWidthExtra,
      );
    }
    const text = settings.showCollapsedText
      ? (agentTitle !== null ? AGENT_ICON_TEXT + agentTitle : null) ??
        (lyricWidthText !== null ? AGENT_ICON_TEXT + lyricWidthText : null) ??
        collapsedTaskTitle ?? (collapsedTodoCount !== null
        ? t.island.pendingTodos(collapsedTodoCount)
        : settings.showTitle ? t.island.appName : "")
      : "";
    const iconWidth = settings.showCollapsedText && agentTitle !== null ? agentIconWidth : 0;
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
  }, [agentIconWidth, agentTitle, lyricWidthText, noticeText, center, centerWidth, collapsedTaskTitle, collapsedTodoCount, isPeeking, settings.collapsedWidthExtra, settings.showCollapsedText, settings.showTitle, sideWidth, t]);

  return { collapsedTaskTitle, collapsedTodoCount, collapsedIslandWidth };
}
