import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "../../../i18n";
import type { IslandSettings } from "../../../lib/settings/types";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributed, useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { todoFileData } from "../todoStore";
import type { TodoItem } from "../types";
import { useCollapsedTodo } from "../useCollapsedTodo";
import { useTodoHostEvent } from "../useTodoHostEvent";
import { useTodos } from "../useTodos";
import { todoLine, todosIsland } from "./islandState";
import { OWNER } from "./owner.ts";
import { announceTodosChanged, todoApi } from "./todoApi";
import { todoLineContributions } from "./todoLines";
import { useTodoQuickAddRunner } from "./useTodoQuickAddRunner";

type RunnerProps = {
  mode: string;
  page: string;
  isTucked: boolean;
  barText: boolean;
  settings: IslandSettings;
  setSettings: Dispatch<SetStateAction<IslandSettings>>;
  openEnabledPage: (page: "todo") => void;
  collapseIsland: () => void;
  openSettings: (section: "savePath") => void;
};

const NO_TODOS: TodoItem[] = [];
const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function TodosRunner({ mode, page, isTucked, barText, settings, setSettings, openEnabledPage, collapseIsland, openSettings }: RunnerProps) {
  const t = useTranslation();
  const openSavePathSettings = useCallback(() => openSettings("savePath"), [openSettings]);
  const saveProjects = useCallback((todoProjects: IslandSettings["todoProjects"]) => {
    setSettings((current) => ({ ...current, todoProjects }));
  }, [setSettings]);
  const { todos, activeTodoId, apiHandlers, notebookProps, addTodoOn } = useTodos({
    carryOverIncompleteTodos: settings.carryOverIncompleteTodos,
    projects: settings.todoProjects,
    onProjectsChange: saveProjects,
    onStartTodo: collapseIsland,
    onMissingSaveDirectory: openSavePathSettings,
  });
  const on = settings.todoEnabled;
  useTodoQuickAddRunner({
    enabled: on,
    mode,
    page,
    pageMode: notebookProps.pageMode,
    todos,
    scheduledTodos: notebookProps.scheduledTodos,
    onShowToday: notebookProps.onShowToday,
    openEnabledPage,
    collapseIsland,
  });
  todoApi.useProvide(apiHandlers);
  const date = notebookProps.currentDate;
  const fromRust = todoFileData() !== null;
  useTodoHostEvent("todos.changed", [date, todos, notebookProps.scheduledTodos, activeTodoId], date, fromRust);
  useTodoHostEvent("note.changed", [date, notebookProps.dailyNote], date, fromRust);
  useEffect(() => announceTodosChanged(date), [date, todos, notebookProps.scheduledTodos, activeTodoId, notebookProps.dailyNote]);
  todosIsland.useProvide(useMemo(() => ({ todos, activeTodoId, notebookProps, addTodoOn }), [todos, activeTodoId, notebookProps, addTodoOn]));
  const previewing = useIslandContributed().preview !== null;
  const { collapsedTaskTitle: title, collapsedTodoCount: count } = useCollapsedTodo(
    on ? todos : NO_TODOS,
    on ? activeTodoId : null,
    on ? settings : { ...settings, showIdleTodoCount: false },
    mode !== "collapsed" || isTucked || !barText || previewing,
  );
  const line = useMemo(() => ({ title, count }), [title, count]);
  todoLine.useProvide(line);
  const inProgress = useMemo(() => activeTodoId !== null && todos.some((todo) => todo.id === activeTodoId && !todo.completed), [activeTodoId, todos]);
  const list = todoLineContributions(line, t);
  if (settings.autoTuckHoldTodo && on && inProgress) list.push({ kind: "hold", reason: "todos.active" });
  if (activeTodoId !== null) list.push({ kind: "hint", key: "todos.active" });
  useIslandContributions(OWNER, "todos.island", list);
  return null;
}

runnerSlot.add({ id: "todos.runner", component: TodosRunner }, OWNER);
