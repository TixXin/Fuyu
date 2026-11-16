import { todosV1, type ScheduledTodoEntry, type TodoEntry } from "@fuyu/plugin-services";
import { useCallback, useEffect, useMemo, useState } from "react";
import { splitProjectPrefix } from "../../lib/todo-projects/prefix.ts";
import { windowServices } from "../plugin-kernel/services";

type TodoDay = { todos: TodoEntry[]; scheduled: ScheduledTodoEntry[] };

export type TodoLink = TodoDay & { onAdd: (title: string, date: string) => void };

const todos = windowServices.get(todosV1);

export function useTodoLink(enabled: boolean): TodoLink | null {
  const [day, setDay] = useState<TodoDay | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = () => {
      todos.list({}).then(
        (answer) => live && setDay({ todos: answer.todos, scheduled: answer.scheduled }),
        () => live && setDay(null),
      );
    };
    load();
    const off = todos.on("changed", load);
    return () => {
      live = false;
      off();
    };
  }, [enabled]);
  const onAdd = useCallback((text: string, date: string) => {
    const { title, project } = splitProjectPrefix(text);
    if (!title) return;
    todos.add({ title, date, ...(project ? { project } : {}) }).catch((error: unknown) => {
      console.error("Failed to add a todo from the calendar", error);
    });
  }, []);
  return useMemo(() => (enabled && day ? { ...day, onAdd } : null), [enabled, day, onAdd]);
}
