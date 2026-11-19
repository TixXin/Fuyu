import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Sun } from "lucide-react";
import { RowMenu } from "../../../components/list/RowMenu";
import { useTranslation } from "../../../i18n";
import { TodoDatePicker } from "../TodoDatePicker";
import { isInProgress } from "../activeTodos";
import { composerTarget } from "../newTodoDefaults.ts";
import { groupByProject, projectsOf } from "../project";
import type { TodoTags } from "../tags";
import { sortTodos } from "../todoPrefs.ts";
import type { TodoItem } from "../types";
import { useTodoNotebookEditing } from "../useTodoNotebookEditing";
import { useTodoPrefs } from "../useTodoPrefs";
import { INBOX, TodoProjectFilter, TodoProjectHeading } from "./TodoProjectFilter";
import { TodoIslandRow } from "./TodoIslandRow";

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
  projects: savedProjects,
  defaultProject,
  onCreateProject,
  onToggleTodo,
  onUpdateTodo,
  onTagTodo,
  onStartTodo,
  onDeleteTodo,
  onReorderTodo,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onUpdateTodoNote,
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
  projects: readonly string[];
  defaultProject?: string;
  onCreateProject?: (name: string) => string | undefined;
  onToggleTodo: (id: string) => void;
  onUpdateTodo: (id: string, title: string) => void;
  onTagTodo: (id: string, tags: TodoTags) => void;
  onStartTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onReorderTodo: (sourceId: string, targetId: string) => void;
  onAddSubtask?: (todoId: string, title: string) => void;
  onToggleSubtask?: (todoId: string, subtaskId: string) => void;
  onDeleteSubtask?: (todoId: string, subtaskId: string) => void;
  onUpdateTodoNote?: (todoId: string, note: string) => void;
}) {
  const t = useTranslation();
  const text = t.todoIsland;
  const [prefs] = useTodoPrefs();
  const canReorder = editable && enableTodoReorder && prefs.sortBy !== "createdDesc";
  const editing = useTodoNotebookEditing(editable, canReorder, onUpdateTodo, onReorderTodo);
  const later = draftDate !== null && draftDate > currentDate;
  const [doneFolded, setDoneFolded] = useState(false);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());
  const toggleExpand = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const projects = editable ? [...new Set([...savedProjects, ...projectsOf(todos)])] : projectsOf(todos);
  const [pickedProject, setPickedProject] = useState<string | null>(null);
  const filter = (editable && pickedProject === INBOX) || (pickedProject && projects.includes(pickedProject)) ? pickedProject : null;
  const shown = filter === null ? todos : todos.filter((todo) => (todo.project ?? INBOX) === filter);
  const [pickedTarget, setPickedTarget] = useState<string | null>(null);
  const target = composerTarget({ picked: pickedTarget, filter, defaultProject, projects });
  const pickFilter = (project: string | null) => {
    setPickedProject(project);
    setPickedTarget(null);
  };
  const grouped = projects.length > 0 && filter === null;
  const sorted = editable ? sortTodos(shown, prefs.sortBy) : shown;
  const open = !editable || prefs.doneDisplay === "inline" ? sorted : sorted.filter((todo) => !todo.completed);
  const done = editable && prefs.doneDisplay === "fold" ? sorted.filter((todo) => todo.completed) : [];
  const allHiddenDone = editable && prefs.doneDisplay === "hide" && todos.length > 0 && open.length === 0;
  const row = (todo: TodoItem, inGroup = false) => (
    <TodoIslandRow
      key={todo.id}
      todo={todo}
      showProject={!inGroup && filter === null}
      showElapsed={prefs.showElapsed}
      editable={editable}
      isActive={editable && (todo.id === activeTodoId || isInProgress(todo)) && !todo.completed}
      canReorder={canReorder}
      isDragging={editing.draggedTodoId === todo.id}
      isDragOver={editing.dragOverTodoId === todo.id}
      isEditing={editing.editingTodoId === todo.id}
      isExpanded={expandedIds.has(todo.id)}
      titleDraft={editing.todoTitleDraft}
      onTitleDraftChange={editing.setTodoTitleDraft}
      onCommitEdit={editing.commitTodoTitleEdit}
      onCancelEdit={editing.cancelTodoTitleEdit}
      onStartEdit={editing.startTodoTitleEdit}
      onToggle={onToggleTodo}
      onStart={onStartTodo}
      onDelete={onDeleteTodo}
      onTag={onTagTodo}
      onToggleExpand={toggleExpand}
      onAddSubtask={onAddSubtask}
      onToggleSubtask={onToggleSubtask}
      onDeleteSubtask={onDeleteSubtask}
      onUpdateTodoNote={onUpdateTodoNote}
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
            if (target === INBOX) onAddTodo();
            else onAddTodo(target);
          }}
        >
          <Plus size={15} strokeWidth={2.1} aria-hidden="true" />
          <input
            value={draft}
            placeholder={later ? text.addPlaceholderFor(draftDate) : text.addPlaceholder}
            aria-label={t.notebook.addTaskHint}
            title={text.projectHint}
            onChange={(event) => onDraftChange(event.currentTarget.value)}
          />
          <RowMenu
            label={text.addToProject(target || text.noProject)}
            buttonClassName="todo-date-picker__button todo-island__project-pick"
            items={[INBOX, ...projects].map((project) => ({ key: `p:${project}`, label: project || text.noProject, onSelect: () => setPickedTarget(project) }))}
          >
            {target || text.noProject}
          </RowMenu>
          <TodoDatePicker value={draftDate} today={currentDate} disabled={false} onChange={onDraftDateChange} labels={{ today: text.today, tomorrow: text.tomorrow }} />
        </form>
      )}
      {(editable || projects.length > 0) && (
        <TodoProjectFilter projects={projects} value={filter} onChange={pickFilter} inbox={editable} onCreate={editable ? onCreateProject : undefined} />
      )}
      <div className={todos.length > scrollStartRows ? "todo-list todo-island__list todo-island__list--scroll" : "todo-list todo-island__list"} role="list">
        {todos.length === 0 || allHiddenDone ? (
          <div className="island-list-empty todo-island__empty">
            {editable && <span className="island-list-empty__icon" aria-hidden="true"><Sun size={22} strokeWidth={1.8} /></span>}
            <strong>{allHiddenDone ? text.allDoneTitle : editable ? text.emptyTitle : text.noArchiveTasks}</strong>
            {editable && <small>{allHiddenDone ? text.allDoneHint : text.emptyHint}</small>}
          </div>
        ) : (
          <>
            {grouped
              ? groupByProject(open, projects).map((group) => [
                <TodoProjectHeading key={`project:${group.project ?? ""}`} project={group.project} open={editable ? group.todos.filter((todo) => !todo.completed).length : 0} />,
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
