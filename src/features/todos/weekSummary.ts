import { weekdayOf } from "./datePicker.ts";
import { addDays, isDateString } from "./schedule.ts";
import type { TodoArchive, TodoItem } from "./types";

export type WeekSummaryDay = { date: string; done: number; today: boolean };
export type WeekSummaryProject = { project: string | null; minutes: number };
export type WeekSummary = {
  days: WeekSummaryDay[];
  done: number;
  focusMinutes: number;
  projects: WeekSummaryProject[];
};

type SummaryTodo = Pick<TodoItem, "title" | "completed" | "project" | "focusMinutes">;

export const WEEK_SUMMARY_PROJECTS = 3;

const minutesOf = (todo: SummaryTodo) =>
  typeof todo.focusMinutes === "number" && Number.isFinite(todo.focusMinutes) && todo.focusMinutes > 0 ? Math.floor(todo.focusMinutes) : 0;

const projectOf = (todo: SummaryTodo) => todo.project || null;

export function weekStartOf(date: string, firstDay: number) {
  return addDays(date, -((weekdayOf(date) - firstDay + 7) % 7));
}

function focusGained(todos: readonly SummaryTodo[], dayBefore: readonly SummaryTodo[]) {
  const carried = dayBefore.filter((todo) => !todo.completed && minutesOf(todo) > 0);
  return todos.map((todo) => {
    const minutes = minutesOf(todo);
    const index = carried.findIndex((before) => before.title === todo.title && projectOf(before) === projectOf(todo) && minutesOf(before) <= minutes);
    const already = index < 0 ? 0 : minutesOf(carried.splice(index, 1)[0]);
    return { project: projectOf(todo), minutes: minutes - already };
  });
}

export function summarizeWeek(archives: readonly TodoArchive[], today: string, todos: readonly TodoItem[], firstDay: number): WeekSummary {
  if (!isDateString(today)) return { days: [], done: 0, focusMinutes: 0, projects: [] };
  const start = weekStartOf(today, firstDay);
  const recorded = new Map<string, readonly SummaryTodo[]>();
  for (const archive of archives) {
    if (isDateString(archive.date) && archive.date < today) recorded.set(archive.date, archive.todos);
  }
  recorded.set(today, todos);
  const dates = [...recorded.keys()].sort();

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    return { date, done: (recorded.get(date) ?? []).filter((todo) => todo.completed).length, today: date === today };
  });

  const byProject = new Map<string | null, number>();
  dates.forEach((date, index) => {
    if (date < start) return;
    const dayBefore = index > 0 ? recorded.get(dates[index - 1]) ?? [] : [];
    for (const { project, minutes } of focusGained(recorded.get(date) ?? [], dayBefore)) {
      if (minutes > 0) byProject.set(project, (byProject.get(project) ?? 0) + minutes);
    }
  });
  const ranked = [...byProject].map(([project, minutes]) => ({ project, minutes })).sort((a, b) => b.minutes - a.minutes);

  return {
    days,
    done: days.reduce((sum, day) => sum + day.done, 0),
    focusMinutes: ranked.reduce((sum, item) => sum + item.minutes, 0),
    projects: ranked.slice(0, WEEK_SUMMARY_PROJECTS),
  };
}
