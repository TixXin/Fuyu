import { Flag, Repeat } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { RowMenu, type RowMenuItem } from "../../../components/list/RowMenu";
import { TODO_RECURRENCE_KINDS } from "../recurrence";
import { TODO_COLORS, TODO_PRIORITIES, type TodoTags } from "../tags";
import type { TodoColor, TodoPriority, TodoRecurrence } from "../types";
import "./TodoTags.css";

type Tagged = {
  title: string;
  priority?: TodoPriority;
  color?: TodoColor;
  recurrence?: TodoRecurrence;
};

const FLAG = { size: 13, strokeWidth: 2, "aria-hidden": true } as const;
const REPEAT = { size: 12, strokeWidth: 2.1, "aria-hidden": true } as const;

export function TodoTagMarks({ todo }: { todo: Tagged }) {
  if (!todo.priority && !todo.color && !todo.recurrence) return null;
  return (
    <span className="todo-tag-marks" aria-hidden="true">
      {todo.color && <span className="todo-tag-dot" data-color={todo.color} />}
      {todo.priority && <Flag {...FLAG} className={`todo-tag-flag todo-tag-flag--${todo.priority}`} />}
      {todo.recurrence && <Repeat {...REPEAT} className="todo-tag-repeat" />}
    </span>
  );
}

export function TodoTagMenu({ todo, onTag }: { todo: Tagged; onTag: (tags: TodoTags) => void }) {
  const text = useTranslation().todoIsland.tags;
  const tagged = Boolean(todo.priority || todo.color || todo.recurrence);
  const items: RowMenuItem[] = [
    ...TODO_PRIORITIES.map((priority) => ({
      key: `priority:${priority}`,
      label: text.priority[priority],
      icon: <Flag {...FLAG} className={`todo-tag-flag todo-tag-flag--${priority}`} />,
      disabled: todo.priority === priority,
      onSelect: () => onTag({ priority }),
    })),
    ...(todo.priority ? [{ key: "priority:none", label: text.noPriority, onSelect: () => onTag({ priority: undefined }) }] : []),
    ...TODO_COLORS.map((color) => ({
      key: `color:${color}`,
      label: text.color[color],
      icon: <span className="todo-tag-dot" data-color={color} aria-hidden="true" />,
      disabled: todo.color === color,
      onSelect: () => onTag({ color }),
    })),
    ...(todo.color ? [{ key: "color:none", label: text.noColor, onSelect: () => onTag({ color: undefined }) }] : []),
    ...TODO_RECURRENCE_KINDS.map((kind) => ({
      key: `recurrence:${kind}`,
      label: text.recurrence[kind],
      icon: <Repeat {...REPEAT} className="todo-tag-repeat" />,
      disabled: todo.recurrence?.kind === kind && (todo.recurrence?.interval ?? 1) === 1,
      onSelect: () => onTag({ recurrence: { kind } }),
    })),
    ...(todo.recurrence ? [{ key: "recurrence:none", label: text.noRecurrence, onSelect: () => onTag({ recurrence: undefined }) }] : []),
  ];

  return (
    <RowMenu label={text.menu(todo.title)} items={items} buttonClassName={`todo-tag-button${tagged ? " todo-tag-button--set" : ""}`}>
      {tagged ? <TodoTagMarks todo={todo} /> : <Flag {...FLAG} className="todo-tag-flag" />}
    </RowMenu>
  );
}
