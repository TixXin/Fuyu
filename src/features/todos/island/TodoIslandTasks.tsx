import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Sun } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { TodoDatePicker } from "../TodoDatePicker";
import type { TodoItem } from "../types";
import { useTodoNotebookEditing } from "../useTodoNotebookEditing";
import { groupByProject, projectsOf } from "../project";
import { TodoIslandRow } from "./TodoIslandRow";
import { TodoProjectFilter, TodoProjectHeading } from "./TodoProjectFilter";

/**
 * Today's list with the field to add to it, or a saved day's list (read-only, no field). Once a
 * todo has a project (issue #44) the open ones group under their projects, with a filter above;
 * with no projects the list looks as before.
 */
export function TodoIslandTasks({
  todos,
  editable,
  draft,
  draftDate,
  currentDate,
  activeTodoId,
  enableTodoReorder,
  scrollStartRows,
  onDraftChange,
  onDraftDateChange,
  onAddTodo,
  onToggleTodo,
  onUpdateTodo,
  onStartTodo,
  onDeleteTodo,
  onReorderTodo,
}: {
  todos: TodoItem[];
  editable: boolean;
  draft: string;
  draftDate: string | null;
  currentDate: string;
  activeTodoId: string | null;
  enableTodoReorder: boolean;
  scrollStartRows: number;
  onDraftChange: (value: string) => void;
  onDraftDateChange: (date: string | null) => void;
  onAddTodo: (project?: string) => void;
  onToggleTodo: (id: string) => void;
  onUpdateTodo: (id: string, title: string) => void;
  onStartTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onReorderTodo: (sourceId: string, targetId: string) => void;
}) {
  const t = useTranslation();
  const text = t.todoIsland;
  const canReorder = editable && enableTodoReorder;
  const editing = useTodoNotebookEditing(editable, canReorder, onUpdateTodo, onReorderTodo);
  const later = draftDate !== null && draftDate > currentDate;
  const [doneFolded, setDoneFolded] = useState(false);
  const projects = projectsOf(todos);
  const [pickedProject, setPickedProject] = useState<string | null>(null);
  const filter = pickedProject !== null && projects.includes(pickedProject) ? pickedProject : null;
  const shown = filter === null ? todos : todos.filter((todo) => todo.project === filter);
  const grouped = projects.length > 0 && filter === null;
  // Today's list keeps what is done under its own fold, below what is still open; a saved day
  // reads in the order it was written.
  const open = editable ? shown.filter((todo) => !todo.completed) : shown;
  const done = editable ? shown.filter((todo) => todo.completed) : [];
  const row = (todo: TodoItem, inGroup = false) => (
    <TodoIslandRow
      key={todo.id}
      todo={todo}
      showProject={!inGroup && filter === null}
      editable={editable}
      isActive={editable && todo.id === activeTodoId && !todo.completed}
      canReorder={canReorder}
      isDragging={editing.draggedTodoId === todo.id}
      isDragOver={editing.dragOverTodoId === todo.id}
      isEditing={editing.editingTodoId === todo.id}
      titleDraft={editing.todoTitleDraft}
      onTitleDraftChange={editing.setTodoTitleDraft}
      onCommitEdit={editing.commitTodoTitleEdit}
      onCancelEdit={editing.cancelTodoTitleEdit}
      onStartEdit={editing.startTodoTitleEdit}
      onToggle={onToggleTodo}
      onStart={onStartTodo}
      onDelete={onDeleteTodo}
      onDragStart={editing.startTodoDrag}
      onDragMove={editing.moveTodoDrag}
      onDragEnd={editing.finishTodoDrag}
      onDragCancel={editing.cancelTodoDrag}
    />
  );

  return (
    <>
      {editable && (
        <form
          className="island-list-search todo-island__composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (filter === null) onAddTodo();
            else onAddTodo(filter);
          }}
        >
          <Plus size={15} strokeWidth={2.1} aria-hidden="true" />
          <input
            value={draft}
            placeholder={later ? text.addPlaceholderFor(draftDate) : filter ?? text.addPlaceholder}
            aria-label={t.notebook.addTaskHint}
            title={text.projectHint}
            onChange={(event) => onDraftChange(event.currentTarget.value)}
          />
          <TodoDatePicker value={draftDate} today={currentDate} disabled={false} onChange={onDraftDateChange} labels={{ today: text.today, tomorrow: text.tomorrow }} />
        </form>
      )}
      {projects.length > 0 && <TodoProjectFilter projects={projects} value={filter} onChange={setPickedProject} />}
      <div className={todos.length > scrollStartRows ? "todo-list todo-island__list todo-island__list--scroll" : "todo-list todo-island__list"} role="list">
        {todos.length === 0 ? (
          <div className="island-list-empty todo-island__empty">
            {editable && <span className="island-list-empty__icon" aria-hidden="true"><Sun size={22} strokeWidth={1.8} /></span>}
            <strong>{editable ? text.emptyTitle : text.noArchiveTasks}</strong>
            {editable && <small>{text.emptyHint}</small>}
          </div>
        ) : (
          <>
            {grouped
              ? groupByProject(open).map((group) => [
                <TodoProjectHeading key={`project:${group.project ?? ""}`} project={group.project} open={editable ? group.todos.length : 0} />,
                ...group.todos.map((todo) => row(todo, true)),
              ])
              : open.map((todo) => row(todo))}
            {done.length > 0 && (
              <div className="todo-island__done-fold" role="listitem">
                <button type="button" aria-expanded={!doneFolded} onClick={() => setDoneFolded((folded) => !folded)}>
                  {doneFolded ? <ChevronRight size={12} strokeWidth={2.2} aria-hidden="true" /> : <ChevronDown size={12} strokeWidth={2.2} aria-hidden="true" />}
                  {text.doneSection(done.length)}
                </button>
              </div>
            )}
            {!doneFolded && done.map((todo) => row(todo))}
          </>
        )}
      </div>
    </>
  );
}
