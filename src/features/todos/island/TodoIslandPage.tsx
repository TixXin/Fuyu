import { useTranslation } from "../../../i18n";
import { ScheduledTodoList } from "../ScheduledTodoList";
import { TodoDataNotice } from "../TodoDataNotice";
import type { TodoPageProps } from "../types";
import { TodoIslandArchive } from "./TodoIslandArchive";
import { TodoIslandHeader } from "./TodoIslandHeader";
import { TodoIslandTasks } from "./TodoIslandTasks";
import "../../../components/list/IslandList.css";
import "./TodoIslandPage.css";
import "./TodoIslandRow.css";

export function TodoIslandPage(props: TodoPageProps) {
  const t = useTranslation();
  const { pageMode, todos, selectedArchive } = props;
  const isReview = pageMode === "review";
  const shown = isReview ? selectedArchive?.todos ?? [] : todos;

  return (
    <section className={`todo-island todo-island--${pageMode}`} aria-label={t.notebook.sectionLabel}>
      <TodoIslandHeader
        pageMode={pageMode}
        openCount={todos.filter((todo) => !todo.completed).length}
        doneCount={todos.filter((todo) => todo.completed).length}
        scheduledCount={props.scheduledTodos.length}
        saveState={props.saveState}
        selectedArchive={selectedArchive}
        onShowToday={props.onShowToday}
        onShowDaily={props.onShowDaily}
        onShowUpcoming={props.onShowUpcoming}
        onShowArchive={props.onShowArchive}
        onSaveToday={props.onSaveToday}
        onClearDone={() => todos.filter((todo) => todo.completed).forEach((todo) => props.onDeleteTodo(todo.id))}
      />
      {(pageMode === "today" || isReview) && (
        <TodoIslandTasks
          todos={shown}
          editable={pageMode === "today"}
          draft={props.draft}
          draftDate={props.draftDate}
          currentDate={props.currentDate}
          activeTodoId={props.activeTodoId}
          enableTodoReorder={props.enableTodoReorder}
          scrollStartRows={props.scrollStartRows}
          onDraftChange={props.onDraftChange}
          onDraftDateChange={props.onDraftDateChange}
          onAddTodo={props.onAddTodo}
          projects={props.projects}
          onCreateProject={props.canCreateProject ? props.onCreateProject : undefined}
          onToggleTodo={props.onToggleTodo}
          onUpdateTodo={props.onUpdateTodo}
          onTagTodo={props.onTagTodo}
          onStartTodo={props.onStartTodo}
          onDeleteTodo={props.onDeleteTodo}
          onReorderTodo={props.onReorderTodo}
          onAddSubtask={props.onAddSubtask}
          onToggleSubtask={props.onToggleSubtask}
          onDeleteSubtask={props.onDeleteSubtask}
          onUpdateTodoNote={props.onUpdateTodoNote}
        />
      )}
      {pageMode === "daily" && (
        <textarea
          className="todo-island__note"
          value={props.dailyNote}
          placeholder={t.todoIsland.notePlaceholder}
          aria-label={t.notebook.dailyNoteLabel}
          spellCheck={false}
          onChange={(event) => props.onDailyNoteChange(event.currentTarget.value)}
        />
      )}
      {pageMode === "upcoming" && <ScheduledTodoList todos={props.scheduledTodos} onDelete={props.onDeleteScheduledTodo} onTag={props.onTagScheduledTodo} />}
      {pageMode === "archive" && <TodoIslandArchive archives={props.archives} todos={props.todos} currentDate={props.currentDate} onSelect={props.onSelectArchive} />}
      <TodoDataNotice />
    </section>
  );
}
