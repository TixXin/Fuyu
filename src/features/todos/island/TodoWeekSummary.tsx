import { useMemo } from "react";
import { useTranslation } from "../../../i18n";
import { firstDayOfWeek, weekdayNames } from "../datePicker";
import type { TodoArchive, TodoItem } from "../types";
import { summarizeWeek } from "../weekSummary";
import "./TodoWeekSummary.css";

const EMPTY_BAR_PERCENT = 4;

export function TodoWeekSummary({ archives, todos, currentDate }: { archives: TodoArchive[]; todos: TodoItem[]; currentDate: string }) {
  const t = useTranslation();
  const text = t.todoIsland.weekSummary;
  const firstDay = firstDayOfWeek(t.localeTag);
  const summary = useMemo(() => summarizeWeek(archives, currentDate, todos, firstDay), [archives, currentDate, todos, firstDay]);
  if (summary.days.length === 0) return null;
  if (summary.done === 0 && summary.focusMinutes === 0 && archives.length === 0) return null;

  const duration = (minutes: number) => text.duration(Math.floor(minutes / 60), minutes % 60);
  const names = weekdayNames(t.localeTag, firstDay);
  const weekday = new Intl.DateTimeFormat(t.localeTag, { weekday: "long" });
  const tallest = Math.max(1, ...summary.days.map((day) => day.done));
  const longest = summary.projects[0]?.minutes ?? 0;

  return (
    <section className="todo-week" aria-label={text.label}>
      <div className="todo-week__top">
        <div className="todo-week__sum">
          <strong>{summary.done}</strong>
          <span>{summary.focusMinutes > 0 ? text.doneWithFocus(duration(summary.focusMinutes)) : text.done}</span>
        </div>
        <ol className="todo-week__bars">
          {summary.days.map((day, index) => {
            const label = text.dayDone(weekday.format(new Date(`${day.date}T00:00:00`)), day.done);
            return (
              <li className={day.today ? "todo-week__day todo-week__day--today" : "todo-week__day"} key={day.date} data-done={day.done} aria-label={label} aria-current={day.today ? "date" : undefined}>
                <i style={{ height: `${Math.max(EMPTY_BAR_PERCENT, Math.round((day.done / tallest) * 100))}%` }} />
                <span aria-hidden="true">{names[index]}</span>
              </li>
            );
          })}
        </ol>
      </div>
      {summary.projects.length > 0 && (
        <ul className="todo-week__projects" aria-label={text.projectsLabel}>
          {summary.projects.map(({ project, minutes }) => (
            <li className="todo-week__project" key={project ?? ""}>
              <span className="todo-week__project-name">{project ?? t.todoIsland.noProject}</span>
              <span className="todo-week__project-track"><i style={{ width: `${Math.round((minutes / longest) * 100)}%` }} /></span>
              <span className="todo-week__project-time">{duration(minutes)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
