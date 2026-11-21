import { Check, ListTodo } from "lucide-react";
import { WidgetEmpty, WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import { todosIsland } from "./islandState";
import { TODOS_WIDGET } from "./widgets.ts";
import "./widget.css";

const ROW_PX = 24;
const HEAD_PX = 22;

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

function TodosWidget({ height }: IslandWidgetProps) {
  const t = useTranslation().islandWidgets;
  const props = todosIsland.use()?.notebookProps;
  const todos = props?.todos ?? [];
  const left = todos.filter((todo) => !todo.completed);
  const shown = [...left, ...todos.filter((todo) => todo.completed)].slice(0, Math.max(1, Math.floor((height - HEAD_PX) / ROW_PX)));
  return (
    <WidgetFrame icon={ListTodo} title={t.widgets.todos} aside={todos.length > 0 ? t.content.todosLeft(left.length) : null}>
      {shown.length === 0 ? (
        <WidgetEmpty>{t.content.todosEmpty}</WidgetEmpty>
      ) : (
        <ul className="island-widget__list">
          {shown.map((todo) => (
            <li key={todo.id} className="todo-widget__row" data-done={todo.completed || undefined}>
              <button
                className="todo-widget__check"
                type="button"
                role="checkbox"
                aria-checked={todo.completed}
                aria-label={todo.title}
                onClick={(event) => {
                  event.stopPropagation();
                  props?.onToggleTodo(todo.id);
                }}
              >
                {todo.completed ? <Check size={10} strokeWidth={3} /> : null}
              </button>
              <span>{todo.title}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

widgetSlot.add({ ...TODOS_WIDGET, component: TodosWidget }, TODOS_WIDGET.owner);
