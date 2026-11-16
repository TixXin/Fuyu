import type { ReactNode } from "react";
import { useTranslation } from "../../../i18n";
import { defineSlot } from "../../plugin-kernel/slots";
import { todoLine } from "./islandState";
import { OWNER } from "./owner.ts";

type LineContext = {
  showTitle: boolean;
  center: ReactNode | null;
};

const lineSlot = defineSlot<LineContext>("island.line/v1");

function TodoTitleLine({ showTitle }: LineContext) {
  const todoTitle = todoLine.use().title;
  if (!todoTitle) return null;
  return (
    <span className="island__active-task" key={todoTitle}>
      {showTitle ? "· " : ""}
      {todoTitle}
    </span>
  );
}

function TodoCountLine({ showTitle, center }: LineContext) {
  const t = useTranslation();
  const todoCount = todoLine.use().count;
  if (todoCount === null) return null;
  return (
    <span className="island__todo-count">
      {showTitle ? "· " : ""}
      {center && <span className="island__todo-center">{center}</span>}
      {t.island.pendingTodos(todoCount)}
    </span>
  );
}

lineSlot.add({ id: "todos.title", component: TodoTitleLine }, OWNER);
lineSlot.add({ id: "todos.count", component: TodoCountLine }, OWNER);
