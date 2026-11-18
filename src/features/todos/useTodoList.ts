import { useCallback, useEffect, useMemo, useState, type SetStateAction } from "react";
import { adoptActiveTodo, isInProgress, latestStartedId, toggleStarted, withoutStart } from "./activeTodos.ts";
import { addTodoFocusMinutes, addTodoSubtask, deleteTodoSubtask, toggleTodoSubtask, updateTodoNote } from "./normalize.ts";
import { splitProjectPrefix } from "./project.ts";
import { createTodoId, loadActiveTodoId, loadTodos, saveActiveTodoId, saveTodos } from "./storage.ts";
import { withTags, type TodoTags } from "./tags.ts";
import { insertTodoItem, playTodoCompleteSound, type TodoInsertPosition } from "./todoPrefs.ts";
import type { TodoItem, TodoPriority, TodoRecurrence } from "./types.ts";
import { useTodoFileField } from "./useTodoFileField";

export function useTodoList(
  onStartTodo: () => void,
  options: {
    completionSound?: boolean;
    insertPosition?: TodoInsertPosition;
    autoCompleteFromSubtasks?: boolean;
    onTodoStarted?: (id: string) => void;
    onTodoCompleted?: (todo: TodoItem) => void;
  } = {},
) {
  const {
    completionSound = true,
    insertPosition = "bottom",
    autoCompleteFromSubtasks = false,
    onTodoStarted,
    onTodoCompleted,
  } = options;
  const [todos, setTodos] = useState<TodoItem[]>(() => adoptActiveTodo(loadTodos(), loadActiveTodoId(), Date.now()));
  const [draftTodo, setDraftTodo] = useState("");
  const activeTodoId = useMemo(() => latestStartedId(todos), [todos]);
  const adoptOutsideActive = useCallback((value: SetStateAction<string | null>) => {
    if (typeof value === "function") return;
    setTodos((currentTodos) => adoptActiveTodo(currentTodos, value, Date.now()));
  }, []);
  useTodoFileField("todos", setTodos);
  useTodoFileField("activeTodoId", adoptOutsideActive);

  const insertItem = useCallback(
    (title: string, project?: string, priority?: TodoPriority, recurrence?: TodoRecurrence) => {
      if (!title) return;
      const item: TodoItem = {
        id: createTodoId(),
        title,
        completed: false,
        createdAt: Date.now(),
        ...(project ? { project } : {}),
        ...(priority ? { priority } : {}),
        ...(recurrence ? { recurrence } : {}),
      };
      setTodos((currentTodos) => insertTodoItem(currentTodos, item, insertPosition));
    },
    [insertPosition],
  );

  const addTodo = useCallback(
    (defaultProject?: string) => {
      const { title, project = typeof defaultProject === "string" ? defaultProject : undefined } = splitProjectPrefix(draftTodo);
      if (!title) return;
      insertItem(title, project);
      setDraftTodo("");
    },
    [draftTodo, insertItem],
  );

  const toggleTodo = useCallback(
    (id: string) => {
      const target = todos.find((todo) => todo.id === id);
      if (target && !target.completed) {
        if (completionSound) playTodoCompleteSound();
        onTodoCompleted?.(target);
      }
      setTodos((currentTodos) =>
        currentTodos.map((todo) => (todo.id === id ? withoutStart({ ...todo, completed: !todo.completed }) : todo)),
      );
    },
    [completionSound, onTodoCompleted, todos],
  );

  const tagTodo = useCallback((id: string, tags: TodoTags) => {
    setTodos((currentTodos) => currentTodos.map((todo) => (todo.id === id ? withTags(todo, tags) : todo)));
  }, []);

  const updateTodoTitle = useCallback((id: string, title: string) => {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    setTodos((currentTodos) => currentTodos.map((todo) => (todo.id === id ? { ...todo, title: nextTitle } : todo)));
  }, []);

  const startTodo = useCallback(
    (id: string) => {
      const todo = todos.find((item) => item.id === id);
      if (!todo || todo.completed) return;
      const wasInProgress = isInProgress(todo);
      setTodos((currentTodos) => toggleStarted(currentTodos, id, Date.now()));
      if (!wasInProgress) {
        onStartTodo();
        onTodoStarted?.(id);
      }
    },
    [onStartTodo, onTodoStarted, todos],
  );

  const addSubtask = useCallback((todoId: string, title: string) => {
    setTodos((currentTodos) => currentTodos.map((todo) => (todo.id === todoId ? addTodoSubtask(todo, title) : todo)));
  }, []);

  const toggleSubtask = useCallback(
    (todoId: string, subtaskId: string) => {
      const target = todos.find((todo) => todo.id === todoId);
      if (target) {
        const preview = toggleTodoSubtask(target, subtaskId, autoCompleteFromSubtasks);
        if (preview.autoCompleted) {
          if (completionSound) playTodoCompleteSound();
          onTodoCompleted?.(target);
        }
      }
      setTodos((currentTodos) =>
        currentTodos.map((todo) =>
          todo.id === todoId ? toggleTodoSubtask(todo, subtaskId, autoCompleteFromSubtasks).todo : todo,
        ),
      );
    },
    [autoCompleteFromSubtasks, completionSound, onTodoCompleted, todos],
  );

  const deleteSubtask = useCallback((todoId: string, subtaskId: string) => {
    setTodos((currentTodos) => currentTodos.map((todo) => (todo.id === todoId ? deleteTodoSubtask(todo, subtaskId) : todo)));
  }, []);

  const updateNote = useCallback((todoId: string, note: string) => {
    setTodos((currentTodos) => currentTodos.map((todo) => (todo.id === todoId ? updateTodoNote(todo, note) : todo)));
  }, []);

  const addFocusMinutes = useCallback((todoId: string, minutes: number) => {
    setTodos((currentTodos) => currentTodos.map((todo) => (todo.id === todoId ? addTodoFocusMinutes(todo, minutes) : todo)));
  }, []);

  const stopAllTodos = useCallback(() => {
    setTodos((currentTodos) => (currentTodos.some(isInProgress) ? currentTodos.map(withoutStart) : currentTodos));
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== id));
  }, []);

  const reorderTodo = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setTodos((currentTodos) => {
      const sourceIndex = currentTodos.findIndex((todo) => todo.id === sourceId);
      const targetIndex = currentTodos.findIndex((todo) => todo.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return currentTodos;
      const nextTodos = [...currentTodos];
      const [movedTodo] = nextTodos.splice(sourceIndex, 1);
      nextTodos.splice(targetIndex, 0, movedTodo);
      return nextTodos;
    });
  }, []);

  useEffect(() => { saveTodos(todos); }, [todos]);
  useEffect(() => { saveActiveTodoId(activeTodoId); }, [activeTodoId]);

  return {
    todos, setTodos, draftTodo, setDraftTodo, activeTodoId, stopAllTodos,
    insertItem, addTodo, toggleTodo, updateTodoTitle, tagTodo, startTodo, deleteTodo, reorderTodo,
    addSubtask, toggleSubtask, deleteSubtask, updateNote, addFocusMinutes,
  };
}
