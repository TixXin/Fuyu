import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseTodoInlineSyntax } from "./inlineSyntax.ts";
import { MAX_TODO_PROJECTS, readProject } from "./project.ts";
import { loadCurrentTodoDate, loadDailyNote, saveCurrentTodoDate, saveDailyNote } from "./storage.ts";
import { filterArchivesByRetention } from "./todoPrefs.ts";
import type { TodoItem, TodoPageMode, TodoProject } from "./types.ts";
import { useScheduledTodos } from "./useScheduledTodos";
import { useTodoApiHandlers } from "./useTodoApiHandlers";
import { useTodoArchives } from "./useTodoArchives";
import { useTodoFileField } from "./useTodoFileField";
import { useTodoFocusTimer } from "./useTodoFocusTimer";
import { useTodoList } from "./useTodoList";
import { useTodoPrefs } from "./useTodoPrefs";
import { useTodoProjectSync } from "./useTodoProjectSync";
import { useTodoRollover } from "./useTodoRollover";
import { useTodoSaving } from "./useTodoSaving";
import { useTodoTimedReminders } from "./useTodoTimedReminders";

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
  const [prefs] = useTodoPrefs();
  const focusDoneRef = useRef<(todoId: string, minutes: number) => void>(() => undefined);
  const startFocusTimer = useTodoFocusTimer({
    enabled: prefs.focusTimerEnabled,
    focusMinutes: prefs.focusTimerMinutes,
    onFocusCompleted: (todoId, minutes) => focusDoneRef.current(todoId, minutes),
  });
  const list = useTodoList(onStartTodo, {
    completionSound: prefs.completionSound,
    insertPosition: prefs.insertPosition,
    autoCompleteFromSubtasks: prefs.autoCompleteFromSubtasks,
    onTodoStarted: startFocusTimer,
  });
  focusDoneRef.current = list.addFocusMinutes;
  const { todos, setTodos, draftTodo, setDraftTodo, activeTodoId, stopAllTodos, insertItem } = list;
  const [dailyNote, setDailyNote] = useState(loadDailyNote);
  useTodoFileField("dailyNote", setDailyNote);
  const [currentTodoDate, setCurrentTodoDate] = useState<string>(() => loadCurrentTodoDate(prefs.dayStartHour));
  useTodoTimedReminders({
    enabled: prefs.timedReminderEnabled,
    date: currentTodoDate,
    todos,
  });
  const { archives, setArchives, upsertArchive } = useTodoArchives(prefs.archiveRetentionDays);
  const visibleArchives = useMemo(
    () => filterArchivesByRetention(archives, currentTodoDate, prefs.archiveRetentionDays),
    [archives, currentTodoDate, prefs.archiveRetentionDays],
  );
  const { scheduledTodos, setScheduledTodos, scheduleTodo, deleteScheduledTodo, tagScheduledTodo } =
    useScheduledTodos(currentTodoDate, setTodos, prefs.dayStartHour);
  const editProjects = useTodoProjectSync({
    projects, onProjectsChange, currentDate: currentTodoDate, todos, setTodos, scheduledTodos, setScheduledTodos, archives, setArchives,
  });
  const projectNames = useMemo(() => projects.map((project) => project.name), [projects]);
  const createProject = useCallback((value: string) => {
    const name = readProject(value);
    if (!name) return undefined;
    if (projects.some((project) => project.name === name)) return name;
    return editProjects({ type: "add", name }) ? name : undefined;
  }, [editProjects, projects]);
  const apiHandlers = useTodoApiHandlers({
    date: currentTodoDate, todos, scheduledTodos, activeTodoId, dailyNote, archives,
    setTodos, setDailyNote, scheduleTodo,
  });
  const [draftDate, setDraftDate] = useState<string | null>(null);

  const addTodo = useCallback((defaultProject?: string) => {
    const fallback = typeof defaultProject === "string" ? defaultProject : undefined;
    const parsed = parseTodoInlineSyntax(draftTodo, currentTodoDate, prefs.inlineSyntax);
    if (!parsed.title) return;
    const project = parsed.project ?? fallback;
    const targetDate = parsed.date ?? draftDate;
    if (targetDate && targetDate > currentTodoDate) {
      scheduleTodo(parsed.title, targetDate, project, parsed.priority ? { priority: parsed.priority } : undefined);
    } else {
      insertItem(parsed.title, project, parsed.priority);
    }
    setDraftTodo("");
    setDraftDate(null);
  }, [currentTodoDate, draftDate, draftTodo, insertItem, prefs.inlineSyntax, scheduleTodo, setDraftTodo]);

  const addTodoOn = useCallback((rawTitle: string, date: string) => {
    const parsed = parseTodoInlineSyntax(rawTitle, currentTodoDate, prefs.inlineSyntax);
    if (!parsed.title) return;
    const targetDate = parsed.date ?? date;
    if (targetDate > currentTodoDate) {
      scheduleTodo(parsed.title, targetDate, parsed.project, parsed.priority ? { priority: parsed.priority } : undefined);
      return;
    }
    insertItem(parsed.title, parsed.project, parsed.priority);
  }, [currentTodoDate, insertItem, prefs.inlineSyntax, scheduleTodo]);

  const [todoPageMode, setTodoPageMode] = useState<TodoPageMode>("today");
  const [selectedArchiveDate, setSelectedArchiveDate] = useState<string | null>(null);
  const selectedArchive = visibleArchives.find((archive) => archive.date === selectedArchiveDate) ?? null;
  const { saveDirectory, saveState, markdownOptions, saveTodosToDisk, saveTodayTodos } = useTodoSaving({
    currentTodoDate,
    todos,
    dailyNote,
    markdownPriority: prefs.markdownPriority,
    markdownElapsed: prefs.markdownElapsed,
    upsertArchive,
    onMissingSaveDirectory,
  });

  const openMode = useCallback((mode: TodoPageMode, clearDraft = true) => {
    setTodoPageMode(mode);
    setSelectedArchiveDate(null);
    if (clearDraft) setDraftTodo("");
  }, [setDraftTodo]);

  const selectArchive = useCallback((date: string) => {
    if (date === currentTodoDate) {
      openMode("today");
      return;
    }
    setSelectedArchiveDate(date);
    setTodoPageMode("review");
    setDraftTodo("");
  }, [currentTodoDate, openMode, setDraftTodo]);

  const startDay = useCallback((nextDate: string, carriedTodos: TodoItem[]) => {
    setTodos(carriedTodos);
    stopAllTodos();
    setDailyNote("");
    setCurrentTodoDate(nextDate);
    setTodoPageMode("today");
    setSelectedArchiveDate(null);
  }, [setTodos, stopAllTodos]);

  useTodoRollover({
    currentTodoDate,
    dayStartHour: prefs.dayStartHour,
    markdownOptions,
    todos,
    dailyNote,
    carryOverIncompleteTodos,
    saveDirectory,
    saveTodosToDisk,
    upsertArchive,
    onStartDay: startDay,
  });

  const showUpcoming = useCallback(() => openMode("upcoming", false), [openMode]);
  const showArchive = useCallback(() => openMode("archive"), [openMode]);
  const showDaily = useCallback(() => openMode("daily"), [openMode]);
  const showToday = useCallback(() => openMode("today"), [openMode]);

  useEffect(() => { saveDailyNote(dailyNote); }, [dailyNote]);
  useEffect(() => { saveCurrentTodoDate(currentTodoDate); }, [currentTodoDate]);

  return {
    todos,
    activeTodoId,
    apiHandlers,
    addTodoOn,
    notebookProps: {
      todos,
      dailyNote,
      draft: draftTodo,
      activeTodoId,
      currentDate: currentTodoDate,
      pageMode: todoPageMode,
      archives: visibleArchives,
      selectedArchive,
      saveState,
      draftDate,
      scheduledTodos,
      onDraftChange: setDraftTodo,
      onDraftDateChange: setDraftDate,
      onAddTodo: addTodo,
      projects: projectNames,
      canCreateProject: projects.length < MAX_TODO_PROJECTS,
      onCreateProject: createProject,
      onShowUpcoming: showUpcoming,
      onDeleteScheduledTodo: deleteScheduledTodo,
      onTagScheduledTodo: tagScheduledTodo,
      onToggleTodo: list.toggleTodo,
      onUpdateTodo: list.updateTodoTitle,
      onTagTodo: list.tagTodo,
      onStartTodo: list.startTodo,
      onDeleteTodo: list.deleteTodo,
      onReorderTodo: list.reorderTodo,
      onAddSubtask: list.addSubtask,
      onToggleSubtask: list.toggleSubtask,
      onDeleteSubtask: list.deleteSubtask,
      onUpdateTodoNote: list.updateNote,
      onSaveToday: saveTodayTodos,
      onShowArchive: showArchive,
      onShowDaily: showDaily,
      onShowToday: showToday,
      onDailyNoteChange: setDailyNote,
      onSelectArchive: selectArchive,
    },
  };
}
