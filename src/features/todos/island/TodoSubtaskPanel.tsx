import { useEffect, useRef, useState } from "react";
import { Check, FileText, Plus, X } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { MAX_TODO_NOTE_LENGTH, MAX_TODO_SUBTASKS } from "../normalize.ts";
import type { TodoItem } from "../types";

export function TodoSubtaskPanel({
  todo,
  editable,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onUpdateTodoNote,
}: {
  todo: TodoItem;
  editable: boolean;
  onAddSubtask?: (todoId: string, title: string) => void;
  onToggleSubtask?: (todoId: string, subtaskId: string) => void;
  onDeleteSubtask?: (todoId: string, subtaskId: string) => void;
  onUpdateTodoNote?: (todoId: string, note: string) => void;
}) {
  const t = useTranslation();
  const text = t.todoIsland;
  const subtasks = todo.subtasks ?? [];
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState(todo.note ?? "");
  const noteFocusedRef = useRef(false);

  useEffect(() => {
    if (!noteFocusedRef.current) {
      setNoteDraft(todo.note ?? "");
    }
  }, [todo.note]);

  const submitSubtask = () => {
    const trimmed = subtaskDraft.trim();
    if (!trimmed) return;
    onAddSubtask?.(todo.id, trimmed);
    setSubtaskDraft("");
  };

  const commitNote = () => {
    noteFocusedRef.current = false;
    onUpdateTodoNote?.(todo.id, noteDraft);
  };

  return (
    <div className="todo-island-row__details">
      {subtasks.length > 0 && (
        <div className="todo-subtask-list" role="list">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className={subtask.completed ? "todo-subtask todo-subtask--done" : "todo-subtask"}
              role="listitem"
            >
              <button
                className="todo-subtask__check"
                type="button"
                aria-pressed={subtask.completed}
                disabled={!editable}
                aria-label={t.todo.actionOnTask(subtask.completed ? t.todo.markIncomplete : t.todo.complete, subtask.title)}
                onClick={() => onToggleSubtask?.(todo.id, subtask.id)}
              >
                {subtask.completed && <Check size={10} strokeWidth={2.6} aria-hidden="true" />}
              </button>
              <span className="todo-subtask__title">{subtask.title}</span>
              {editable && (
                <button
                  className="todo-subtask__delete"
                  type="button"
                  aria-label={t.todo.deleteSubtask(subtask.title)}
                  onClick={() => onDeleteSubtask?.(todo.id, subtask.id)}
                >
                  <X size={12} strokeWidth={1.8} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {editable && subtasks.length < MAX_TODO_SUBTASKS && (
        <div className="todo-subtask-composer">
          <Plus size={12} strokeWidth={2} aria-hidden="true" />
          <input
            className="todo-subtask-composer__input"
            value={subtaskDraft}
            placeholder={text.addSubtaskPlaceholder}
            aria-label={text.addSubtaskPlaceholder}
            onChange={(event) => setSubtaskDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submitSubtask();
              }
            }}
          />
        </div>
      )}
      {editable ? (
        <div className="todo-subtask-note">
          <FileText size={12} strokeWidth={1.8} aria-hidden="true" />
          <input
            className="todo-subtask-note__input"
            value={noteDraft}
            maxLength={MAX_TODO_NOTE_LENGTH}
            placeholder={text.itemNotePlaceholder}
            aria-label={text.itemNoteLabel}
            onFocus={() => {
              noteFocusedRef.current = true;
            }}
            onChange={(event) => setNoteDraft(event.currentTarget.value)}
            onBlur={commitNote}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
          />
        </div>
      ) : todo.note ? (
        <div className="todo-subtask-note todo-subtask-note--readonly">
          <FileText size={12} strokeWidth={1.8} aria-hidden="true" />
          <span className="todo-subtask-note__text">{todo.note}</span>
        </div>
      ) : null}
    </div>
  );
}
