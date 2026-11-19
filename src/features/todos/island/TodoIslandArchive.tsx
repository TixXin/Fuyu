import { ChevronRight } from "lucide-react";
import { useTranslation } from "../../../i18n";
import type { TodoArchive, TodoItem } from "../types";
import { TodoWeekSummary } from "./TodoWeekSummary";

type TodoIslandArchiveProps = {
  archives: TodoArchive[];
  todos?: TodoItem[];
  currentDate?: string;
  showWeekSummary?: boolean;
  onSelect: (date: string) => void;
};

const NO_TODOS: TodoItem[] = [];

export function TodoIslandArchive({ archives, todos = NO_TODOS, currentDate = "", showWeekSummary = true, onSelect }: TodoIslandArchiveProps) {
  const t = useTranslation();
  const text = t.todoIsland;
  const summary = showWeekSummary ? <TodoWeekSummary archives={archives} todos={todos} currentDate={currentDate} /> : null;
  if (archives.length === 0) {
    return (
      <div className="todo-island__archive">
        {summary}
        <div className="island-list-empty todo-island__empty"><strong>{text.noArchives}</strong></div>
      </div>
    );
  }
  const month = new Intl.DateTimeFormat(t.localeTag, { year: "numeric", month: "long" });
  const monthDay = new Intl.DateTimeFormat(t.localeTag, { month: "numeric", day: "numeric" });
  const weekday = new Intl.DateTimeFormat(t.localeTag, { weekday: "short" });
  const groups = new Map<string, TodoArchive[]>();
  for (const archive of [...archives].sort((a, b) => b.date.localeCompare(a.date))) {
    const key = archive.date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), archive]);
  }

  return (
    <div className="todo-island__archive">
      {summary}
      <div className="todo-island__archive-list" role="list">
        {[...groups].map(([key, days]) => (
          <div className="todo-island__archive-month" key={key} role="group" aria-label={month.format(new Date(`${key}-01T00:00:00`))}>
            <div className="todo-island__section-label">{month.format(new Date(`${key}-01T00:00:00`))}</div>
            {days.map((archive) => {
              const total = archive.todos.length;
              const done = archive.todos.filter((todo) => todo.completed).length;
              const first = archive.todos.find((todo) => !todo.completed) ?? archive.todos[0];
              const date = new Date(`${archive.date}T00:00:00`);
              return (
                <button className="todo-island__archive-day" key={archive.date} type="button" role="listitem" onClick={() => onSelect(archive.date)}>
                  <span className="todo-island__archive-date" aria-label={`${monthDay.format(date)} ${weekday.format(date)}`}>
                    <strong>{date.getDate()}</strong>
                    <small>{weekday.format(date)}</small>
                  </span>
                  <span className="todo-island__archive-text">
                    <span className="todo-island__archive-preview">{first?.title ?? text.noArchiveTasks}</span>
                    {total > 0 && (
                      <span className="todo-island__archive-progress" aria-label={text.doneOf(done, total)}>
                        <span className="todo-island__archive-bar"><span style={{ width: `${(done / total) * 100}%` }} /></span>
                        {done}/{total}
                      </span>
                    )}
                  </span>
                  <ChevronRight size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
