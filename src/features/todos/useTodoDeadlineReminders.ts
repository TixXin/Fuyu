import { useEffect, useRef } from "react";
import type { WindowServices } from "@fuyu/plugin-base/client/window-services";
import { remindersV1, type Reminder } from "@fuyu/plugin-services";
import { windowServices } from "../plugin-kernel/services.ts";
import { DEADLINE_REMINDER_SOURCE, pickDeadlineReminders, type TodoDeadlineReminder } from "./deadline.ts";
import type { TodoItem } from "./types.ts";

const remindedDeadlines = new Set<string>();

export function dispatchDeadlineReminders({
  services = windowServices,
  todos,
  date,
  mode,
  titles,
  seen = remindedDeadlines,
}: {
  services?: Pick<WindowServices, "get" | "has">;
  todos: readonly Pick<TodoItem, "id" | "title" | "completed" | "deadline">[];
  date: string;
  mode: TodoDeadlineReminder;
  titles: { today: string; tomorrow: string };
  seen?: Set<string>;
}): Reminder[] {
  if (!services.has(remindersV1.name)) return [];
  const due = pickDeadlineReminders(todos, date, mode, seen);
  const reminders = due.map<Reminder>(({ id, todo, daysLeft }) => ({
    id,
    source: DEADLINE_REMINDER_SOURCE,
    icon: "bell",
    title: daysLeft === 0 ? titles.today : titles.tomorrow,
    detail: todo.title,
    snoozable: true,
  }));
  for (const reminder of reminders) {
    void services.get(remindersV1).push(reminder).catch(() => undefined);
  }
  return reminders;
}

export function useTodoDeadlineReminders({
  mode,
  date,
  todos,
  titles,
}: {
  mode: TodoDeadlineReminder;
  date: string;
  todos: readonly TodoItem[];
  titles: { today: string; tomorrow: string };
}) {
  const todosRef = useRef(todos);
  todosRef.current = todos;
  const titlesRef = useRef(titles);
  titlesRef.current = titles;

  useEffect(() => {
    if (mode === "off") return;
    const check = () => {
      dispatchDeadlineReminders({ todos: todosRef.current, date, mode, titles: titlesRef.current });
    };
    check();
    return windowServices.watch(check);
  }, [date, mode, todos]);
}
