import type { ReactNode } from "react";
import { useTranslation } from "../../../i18n";
import { defineSlot } from "../../plugin-kernel/slots";

type LineContext = {
  showTitle: boolean;
  center: ReactNode | null;
  todoTitle: string | null;
  todoCount: number | null;
};

const lineSlot = defineSlot<LineContext>("island.line/v1");

function TodoTitleLine({ showTitle, todoTitle }: LineContext) {
  if (!todoTitle) return null;
  return (
    <span className="island__active-task" key={todoTitle}>
      {showTitle ? "· " : ""}
      {todoTitle}
    </span>
  );
}

function TodoCountLine({ showTitle, center, todoCount }: LineContext) {
  const t = useTranslation();
  if (todoCount === null) return null;
  return (
    <span className="island__todo-count">
      {showTitle ? "· " : ""}
      {center && <span className="island__todo-center">{center}</span>}
      {t.island.pendingTodos(todoCount)}
    </span>
  );
}

lineSlot.add({ id: "todos.title", component: TodoTitleLine });
lineSlot.add({ id: "todos.count", component: TodoCountLine });
