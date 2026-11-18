import type { PointerEvent as ReactPointerEvent } from "react";
import { Check, FileText, GripVertical, ListChecks, Play, Square, Trash2 } from "lucide-react";
import { useTranslation } from "../../../i18n";
import type { TodoTags } from "../tags";
import { todoElapsedLabel } from "../todoPrefs.ts";
import type { TodoItem } from "../types";
import { useElapsedNow } from "../useElapsedNow";
import { TodoSubtaskPanel } from "./TodoSubtaskPanel";
import { TodoTagMarks, TodoTagMenu } from "./TodoTagMenu";

const ICON = { size: 14, strokeWidth: 1.5, absoluteStrokeWidth: true, "aria-hidden": true } as const;

function TodoRowBadges({
  done,
  total,
  hasNote,
  canExpand,
  isExpanded,
  label,
  progressTitle,
  noteTitle,
  onToggle,
}: {
  done: number;
  total: number;
  hasNote: boolean;
  canExpand: boolean;
  isExpanded: boolean;
  label: string;
  progressTitle: string;
  noteTitle: string;
  onToggle: () => void;
}) {
  const inner = (
    <>
      {total > 0 && (
        <span className="todo-island-row__subtask-badge" title={progressTitle}>
          {done}/{total}
        </span>
      )}
      {hasNote && (
        <span className="todo-island-row__note-icon" title={noteTitle}>
          <FileText size={11} strokeWidth={1.8} aria-hidden="true" />
        </span>
      )}
    </>
  );
  if (!canExpand) {
    return <span className="todo-island-row__meta todo-island-row__meta--static">{inner}</span>;
  }
  return (
    <button className="todo-island-row__meta" type="button" aria-expanded={isExpanded} aria-label={label} onClick={onToggle}>
      {inner}
    </button>
  );
}

export function TodoIslandRow({
  todo,
  showProject = false,
  showElapsed = true,
  editable,
  isActive,
  canReorder,
  isDragging,
  isDragOver,
  isEditing,
  isExpanded = false,
  titleDraft,
  onTitleDraftChange,
  onCommitEdit,
  onCancelEdit,
  onStartEdit,
  onToggle,
  onStart,
  onDelete,
  onTag,
  onToggleExpand,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onUpdateTodoNote,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: {
  todo: TodoItem;
  editable: boolean;
  isActive: boolean;
  canReorder: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  showProject?: boolean;
  showElapsed?: boolean;
  isEditing: boolean;
  isExpanded?: boolean;
  titleDraft: string;
  onTitleDraftChange: (value: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onStartEdit: (todo: TodoItem) => void;
  onToggle: (id: string) => void;
  onStart: (id: string) => void;
  onDelete: (id: string) => void;
  onTag: (id: string, tags: TodoTags) => void;
  onToggleExpand?: (id: string) => void;
  onAddSubtask?: (todoId: string, title: string) => void;
  onToggleSubtask?: (todoId: string, subtaskId: string) => void;
  onDeleteSubtask?: (todoId: string, subtaskId: string) => void;
  onUpdateTodoNote?: (todoId: string, note: string) => void;
  onDragStart: (event: ReactPointerEvent<HTMLButtonElement>, todoId: string) => void;
  onDragMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onDragEnd: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onDragCancel: () => void;
}) {
  const t = useTranslation();
  const trackElapsed = isActive && showElapsed && typeof todo.startedAt === "number";
  const now = useElapsedNow(trackElapsed);
  const elapsed = isActive ? todoElapsedLabel(todo.startedAt, now, showElapsed) : null;
  const subtaskTotal = todo.subtasks?.length ?? 0;
  const subtaskDone = todo.subtasks ? todo.subtasks.filter((subtask) => subtask.completed).length : 0;
  const hasNote = Boolean(todo.note?.trim());
  const hasDetails = subtaskTotal > 0 || hasNote;
  const canEditDetails = editable && Boolean(onAddSubtask || onUpdateTodoNote);
  const canExpand = Boolean(onToggleExpand) && (canEditDetails || hasDetails);
  const showDetails = isExpanded && canExpand;
  const expandLabel = showDetails ? t.todo.collapseDetails(todo.title) : t.todo.expandDetails(todo.title);

  const className = [
    "todo-island-row",
    todo.completed ? "todo-island-row--done" : "",
    isActive ? "todo-island-row--active" : "",
    isDragging ? "todo-island-row--dragging" : "",
    isDragOver ? "todo-island-row--drag-over" : "",
    showDetails ? "todo-island-row--expanded" : "",
    canReorder ? "todo-island-row--reorderable" : "",
  ].filter(Boolean).join(" ");

  const titleNode = editable ? (
    <button className="todo-island-row__title todo-island-row__title--editable" type="button" onClick={() => onStartEdit(todo)}>
      {showProject && todo.project && <span className="todo-project-tag">{todo.project}</span>}
      {todo.title}
    </button>
  ) : (
    <span className="todo-island-row__title">
      {showProject && todo.project && <span className="todo-project-tag">{todo.project}</span>}
      {todo.title}
    </span>
  );

  return (
    <div className={className} role="listitem" data-todo-id={todo.id} data-priority={todo.priority}>
      {canReorder && (
        <button
          className="todo-island-row__grip"
          type="button"
          aria-label={t.todo.reorderTask(todo.title)}
          disabled={isEditing}
          onPointerDown={(event) => onDragStart(event, todo.id)}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragCancel}
        >
          <GripVertical {...ICON} />
        </button>
      )}
      <button
        className="todo-island-row__check"
        type="button"
        aria-pressed={todo.completed}
        disabled={!editable}
        aria-label={t.todo.actionOnTask(todo.completed ? t.todo.markIncomplete : t.todo.complete, todo.title)}
        onClick={() => onToggle(todo.id)}
      >
        {todo.completed && <Check size={12} strokeWidth={2.5} aria-hidden="true" />}
      </button>
      <span className="todo-island-row__text">
        {editable && isEditing ? (
          <input
            className="todo-island-row__input"
            value={titleDraft}
            aria-label={t.todo.editTitle}
            autoFocus
            onChange={(event) => onTitleDraftChange(event.currentTarget.value)}
            onBlur={onCommitEdit}
            onKeyDown={(event) => {
              if (event.key === "Enter") onCommitEdit();
              if (event.key === "Escape") onCancelEdit();
            }}
          />
        ) : hasDetails ? (
          <span className="todo-island-row__headline">
            {titleNode}
            <TodoRowBadges
              done={subtaskDone}
              total={subtaskTotal}
              hasNote={hasNote}
              canExpand={canExpand}
              isExpanded={showDetails}
              label={expandLabel}
              progressTitle={t.todoIsland.subtaskProgress(subtaskDone, subtaskTotal)}
              noteTitle={t.todoIsland.hasNote}
              onToggle={() => onToggleExpand?.(todo.id)}
            />
          </span>
        ) : (
          titleNode
        )}
      </span>
      {editable && !isEditing ? <TodoTagMenu todo={todo} onTag={(tags) => onTag(todo.id, tags)} /> : !editable && <TodoTagMarks todo={todo} />}
      {editable && (
        <span className="todo-island-row__actions">
          {isActive ? (
            <button className="todo-island-row__stop" type="button" aria-label={t.todo.actionOnTask(t.todo.stop, todo.title)} onClick={() => onStart(todo.id)}>
              <Square size={10} strokeWidth={0} fill="currentColor" aria-hidden="true" />
              <span className="todo-island-row__stop-state">{elapsed ? t.todoIsland.inProgressElapsed(elapsed) : t.todoIsland.inProgress}</span>
              <span className="todo-island-row__stop-action">{t.todo.stop}</span>
            </button>
          ) : (
            !todo.completed && (
              <button className="todo-island-row__action" type="button" aria-label={t.todo.actionOnTask(t.todo.start, todo.title)} onClick={() => onStart(todo.id)}>
                <Play {...ICON} />
              </button>
            )
          )}
          {canEditDetails && (
            <button
              className={showDetails ? "todo-island-row__action todo-island-row__action--expanded" : "todo-island-row__action"}
              type="button"
              aria-expanded={showDetails}
              aria-label={expandLabel}
              onClick={() => onToggleExpand?.(todo.id)}
            >
              <ListChecks {...ICON} />
            </button>
          )}
          <button className="todo-island-row__action todo-island-row__action--delete" type="button" aria-label={t.todo.deleteTask(todo.title)} onClick={() => onDelete(todo.id)}>
            <Trash2 {...ICON} />
          </button>
        </span>
      )}
      {showDetails && (
        <TodoSubtaskPanel
          todo={todo}
          editable={canEditDetails}
          onAddSubtask={onAddSubtask}
          onToggleSubtask={onToggleSubtask}
          onDeleteSubtask={onDeleteSubtask}
          onUpdateTodoNote={onUpdateTodoNote}
        />
      )}
    </div>
  );
}
