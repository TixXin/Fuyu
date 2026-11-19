import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseTodoInlineSyntax } from "./inlineSyntax.ts";
import { MAX_TODO_PROJECTS, readProject } from "./project.ts";
import { hasPendingRecurringSchedule, nextOccurrenceDate } from "./recurrence.ts";
import { loadCurrentTodoDate, loadDailyNote, saveCurrentTodoDate, saveDailyNote } from "./storage.ts";
import { filterArchivesByRetention } from "./todoPrefs.ts";
import type { TodoItem, TodoPageMode, TodoProject } from "./types.ts";
import { useHolidayMarks } from "./useHolidayMarks";
import { useScheduledTodos } from "./useScheduledTodos";
import { useTodoApiHandlers } from "./useTodoApiHandlers";
import { useTodoArchives } from "./useTodoArchives";
import { useTodoDayReminders } from "./useTodoDayReminders";
import { useTodoFileField } from "./useTodoFileField";
import { useTodoFocusTimer } from "./useTodoFocusTimer";
import { useTodoList } from "./useTodoList";
import { useTodoPrefs } from "./useTodoPrefs";
import { useTodoProjectSync } from "./useTodoProjectSync";
import { useTodoRollover } from "./useTodoRollover";
import { useTodoSaving } from "./useTodoSaving";

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
  const holidayMarks = useHolidayMarks();
  const focusDoneRef = useRef<(todoId: string, minutes: number) => void>(() => undefined);
  const completedRef = useRef<(todo: TodoItem) => void>(() => undefined);
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
    onTodoCompleted: (todo) => completedRef.current(todo),
  });
  focusDoneRef.current = list.addFocusMinutes;
  const { todos, setTodos, draftTodo, setDraftTodo, activeTodoId, stopAllTodos, insertItem } = list;
  const [dailyNote, setDailyNote] = useState(loadDailyNote);
  useTodoFileField("dailyNote", setDailyNote);
  const [currentTodoDate, setCurrentTodoDate] = useState<string>(() => loadCurrentTodoDate(prefs.dayStartHour));
  useTodoDayReminders(prefs, currentTodoDate, todos);
  const { archives, setArchives, upsertArchive } = useTodoArchives(prefs.archiveRetentionDays);
  const visibleArchives = useMemo(
    () => filterArchivesByRetention(archives, currentTodoDate, prefs.archiveRetentionDays),
    [archives, currentTodoDate, prefs.archiveRetentionDays],
  );
  const { scheduledTodos, setScheduledTodos, scheduleTodo, deleteScheduledTodo, tagScheduledTodo } =
    useScheduledTodos(currentTodoDate, setTodos, prefs.dayStartHour, prefs.dueReminderScope);
  completedRef.current = (todo: TodoItem) => {
    if (!todo.recurrence) return;
    if (hasPendingRecurringSchedule(scheduledTodos, todo.title, todo.project, todo.recurrence, currentTodoDate)) return;
    const nextDate = nextOccurrenceDate(currentTodoDate, todo.recurrence, holidayMarks);
    if (nextDate > currentTodoDate) {
      scheduleTodo(todo.title, nextDate, todo.project, {
        priority: todo.priority,
        color: todo.color,
        recurrence: todo.recurrence,
      });
    }
  };
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
    const tags = parsed.priority || parsed.recurrence
      ? { ...(parsed.priority ? { priority: parsed.priority } : {}), ...(parsed.recurrence ? { recurrence: parsed.recurrence } : {}) }
      : undefined;
    if (targetDate && targetDate > currentTodoDate) {
      scheduleTodo(parsed.title, targetDate, project, tags);
    } else {
      insertItem(parsed.title, project, parsed.priority, parsed.recurrence);
    }
    setDraftTodo("");
    setDraftDate(null);
  }, [currentTodoDate, draftDate, draftTodo, insertItem, prefs.inlineSyntax, scheduleTodo, setDraftTodo]);

  const addTodoOn = useCallback((rawTitle: string, date: string) => {
    const parsed = parseTodoInlineSyntax(rawTitle, currentTodoDate, prefs.inlineSyntax);
    if (!parsed.title) return;
    const targetDate = parsed.date ?? date;
    const tags = parsed.priority || parsed.recurrence
      ? { ...(parsed.priority ? { priority: parsed.priority } : {}), ...(parsed.recurrence ? { recurrence: parsed.recurrence } : {}) }
      : undefined;
    if (targetDate > currentTodoDate) {
      scheduleTodo(parsed.title, targetDate, parsed.project, tags);
      return;
    }
    insertItem(parsed.title, parsed.project, parsed.priority, parsed.recurrence);
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
