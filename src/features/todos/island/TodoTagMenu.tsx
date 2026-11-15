import { Flag } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { RowMenu, type RowMenuItem } from "../../../components/list/RowMenu";
import { TODO_COLORS, TODO_PRIORITIES, type TodoTags } from "../tags";
import type { TodoColor, TodoPriority } from "../types";
import "./TodoTags.css";

type Tagged = { title: string; priority?: TodoPriority; color?: TodoColor };

const FLAG = { size: 13, strokeWidth: 2, "aria-hidden": true } as const;

export function TodoTagMarks({ todo }: { todo: Tagged }) {
  if (!todo.priority && !todo.color) return null;
  return (
    <span className="todo-tag-marks" aria-hidden="true">
      {todo.color && <span className="todo-tag-dot" data-color={todo.color} />}
      {todo.priority && <Flag {...FLAG} className={`todo-tag-flag todo-tag-flag--${todo.priority}`} />}
    </span>
  );
}

export function TodoTagMenu({ todo, onTag }: { todo: Tagged; onTag: (tags: TodoTags) => void }) {
  const text = useTranslation().todoIsland.tags;
  const tagged = Boolean(todo.priority || todo.color);
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
  ];

  return (
    <RowMenu label={text.menu(todo.title)} items={items} buttonClassName={`todo-tag-button${tagged ? " todo-tag-button--set" : ""}`}>
      {tagged ? <TodoTagMarks todo={todo} /> : <Flag {...FLAG} className="todo-tag-flag" />}
    </RowMenu>
  );
}
