import { useCallback, useEffect, useMemo, useState } from "react";
import { createTodoId, loadCurrentTodoDate, loadDailyNote, saveCurrentTodoDate, saveDailyNote } from "./storage";
import { MAX_TODO_PROJECTS, readProject, splitProjectPrefix } from "./project";
import type { TodoItem, TodoPageMode, TodoProject } from "./types";
import { useTodoArchives } from "./useTodoArchives";
import { useTodoList } from "./useTodoList";
import { useScheduledTodos } from "./useScheduledTodos";
import { useTodoApiHandlers } from "./useTodoApiHandlers";
import { useTodoRollover } from "./useTodoRollover";
import { useTodoSaving } from "./useTodoSaving";
import { useTodoFileField } from "./useTodoFileField";
import { useTodoProjectSync } from "./useTodoProjectSync";

type TodosOptions = {
  carryOverIncompleteTodos: boolean;
  projects: readonly TodoProject[];
  onProjectsChange: (projects: TodoProject[]) => void;
  onStartTodo: () => void;
  onMissingSaveDirectory: () => void;
};

export function useTodos({
  carryOverIncompleteTodos,
  projects,
  onProjectsChange,
  onStartTodo,
  onMissingSaveDirectory,
}: TodosOptions) {
  const list = useTodoList(onStartTodo);
  const { todos, setTodos, setDraftTodo, activeTodoId, setActiveTodoId } = list;
  const [dailyNote, setDailyNote] = useState(loadDailyNote);
  useTodoFileField("dailyNote", setDailyNote);
  const [currentTodoDate, setCurrentTodoDate] =
    useState<string>(loadCurrentTodoDate);
  const { archives, setArchives, upsertArchive } = useTodoArchives();
  const { scheduledTodos, setScheduledTodos, scheduleTodo, deleteScheduledTodo } =
    useScheduledTodos(currentTodoDate, setTodos);
  useTodoProjectSync({
    projects, onProjectsChange, currentDate: currentTodoDate, todos, setTodos, scheduledTodos, setScheduledTodos, archives, setArchives,
  });
  const projectNames = useMemo(() => projects.map((project) => project.name), [projects]);
  const createProject = useCallback((value: string) => {
    const name = readProject(value);
    if (!name || projects.length >= MAX_TODO_PROJECTS || projects.some((project) => project.name === name)) return;
    onProjectsChange([...projects, { id: createTodoId(), name }]);
  }, [onProjectsChange, projects]);
  const apiHandlers = useTodoApiHandlers({
    date: currentTodoDate, todos, scheduledTodos, activeTodoId, dailyNote, archives,
    setTodos, setDailyNote, scheduleTodo,
  });
  const [draftDate, setDraftDate] = useState<string | null>(null);
  const draftTodo = list.draftTodo;
  const addListTodo = list.addTodo;

  const addTodo = useCallback((defaultProject?: string) => {
    const fallback = typeof defaultProject === "string" ? defaultProject : undefined;
    const { title, project = fallback } = splitProjectPrefix(draftTodo);

    if (draftDate && draftDate > currentTodoDate && title) {
      scheduleTodo(title, draftDate, project);
      setDraftTodo("");
    } else {
      addListTodo(fallback);
    }
    setDraftDate(null);
  }, [addListTodo, currentTodoDate, draftDate, draftTodo, scheduleTodo, setDraftTodo]);
  const addTodoOn = useCallback((title: string, date: string) => {
    const { title: text, project } = splitProjectPrefix(title);
    if (!text) return;
    if (date > currentTodoDate) {
      scheduleTodo(text, date, project);
      return;
    }
    setTodos((current) => [{ id: createTodoId(), title: text, completed: false, createdAt: Date.now(), ...(project ? { project } : {}) }, ...current]);
  }, [currentTodoDate, scheduleTodo, setTodos]);
  const [todoPageMode, setTodoPageMode] = useState<TodoPageMode>("today");
  const [selectedArchiveDate, setSelectedArchiveDate] = useState<string | null>(
    null,
  );
  const selectedArchive =
    archives.find((archive) => archive.date === selectedArchiveDate) ?? null;
  const { saveDirectory, saveState, saveTodosToDisk, saveTodayTodos } =
    useTodoSaving({
      currentTodoDate,
      todos,
      dailyNote,
      upsertArchive,
      onMissingSaveDirectory,
    });

  const showArchive = useCallback(() => {
    setTodoPageMode("archive");
    setSelectedArchiveDate(null);
    setDraftTodo("");
  }, [setDraftTodo]);

  const showToday = useCallback(() => {
    setTodoPageMode("today");
    setSelectedArchiveDate(null);
    setDraftTodo("");
  }, [setDraftTodo]);

  const showDaily = useCallback(() => {
    setTodoPageMode("daily");
    setSelectedArchiveDate(null);
    setDraftTodo("");
  }, [setDraftTodo]);

  const showUpcoming = useCallback(() => {
    setTodoPageMode("upcoming");
    setSelectedArchiveDate(null);
  }, []);

  const selectArchive = useCallback(
    (date: string) => {
      if (date === currentTodoDate) {
        showToday();
        return;
      }

      setSelectedArchiveDate(date);
      setTodoPageMode("review");
      setDraftTodo("");
    },
    [currentTodoDate, setDraftTodo, showToday],
  );

  const startDay = useCallback(
    (nextDate: string, carriedTodos: TodoItem[]) => {
      setTodos(carriedTodos);
      setDailyNote("");
      setActiveTodoId(null);
      setCurrentTodoDate(nextDate);
      setTodoPageMode("today");
      setSelectedArchiveDate(null);
    },
    [setActiveTodoId, setTodos],
  );

  useTodoRollover({
    currentTodoDate,
    todos,
    dailyNote,
    carryOverIncompleteTodos,
    saveDirectory,
    saveTodosToDisk,
    upsertArchive,
    onStartDay: startDay,
  });

  useEffect(() => {
    saveDailyNote(dailyNote);
  }, [dailyNote]);

  useEffect(() => {
    saveCurrentTodoDate(currentTodoDate);
  }, [currentTodoDate]);

  return {
    todos,
    activeTodoId,
    apiHandlers,
    addTodoOn,
    notebookProps: {
      todos,
      dailyNote,
      draft: list.draftTodo,
      activeTodoId,
      currentDate: currentTodoDate,
      pageMode: todoPageMode,
      archives,
      selectedArchive,
      saveState,
      draftDate,
      scheduledTodos,
      onDraftChange: setDraftTodo,
      onDraftDateChange: setDraftDate,
      onAddTodo: addTodo,
      projects: projectNames,
      onCreateProject: createProject,
      onShowUpcoming: showUpcoming,
      onDeleteScheduledTodo: deleteScheduledTodo,
      onToggleTodo: list.toggleTodo,
      onUpdateTodo: list.updateTodoTitle,
      onStartTodo: list.startTodo,
      onDeleteTodo: list.deleteTodo,
      onReorderTodo: list.reorderTodo,
      onSaveToday: saveTodayTodos,
      onShowArchive: showArchive,
      onShowDaily: showDaily,
      onShowToday: showToday,
      onDailyNoteChange: setDailyNote,
      onSelectArchive: selectArchive,
    },
  };
}
