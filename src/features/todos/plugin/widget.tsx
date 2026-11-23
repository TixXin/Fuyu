import { useState, type KeyboardEvent } from "react";
import { Check, ListTodo, Plus } from "lucide-react";
import { clickOnly } from "../../../components/island-widget/clickOnly";
import { WidgetEmpty, WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { WidgetOpenButton } from "../../../components/island-widget/WidgetOpenButton";
import { useTranslation } from "../../../i18n";
import { runIslandAction } from "../../plugin-kernel/useIslandContributions";
import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import { todosIsland } from "./islandState";
import { OPEN_TODOS_ACTION, TODOS_WIDGET } from "./widgets.ts";
import "./widget.css";

const ROW_PX = 24;
const HEAD_PX = 22;

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

const openTodos = () => void runIslandAction(OPEN_TODOS_ACTION);

function TodosWidget({ height }: IslandWidgetProps) {
  const text = useTranslation();
  const t = text.islandWidgets;
  const island = todosIsland.use();
  const props = island?.notebookProps;
  const todos = props?.todos ?? [];
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const left = todos.filter((todo) => !todo.completed);
  const rows = Math.max(1, Math.floor((height - HEAD_PX) / ROW_PX) - (adding ? 1 : 0));
  const shown = [...left, ...todos.filter((todo) => todo.completed)].slice(0, rows);
  const close = () => {
    setAdding(false);
    setDraft("");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    const title = draft.trim();
    if (!title || !island || !props) return;
    island.addTodoOn(title, props.currentDate);
    setDraft("");
  };
  const aside = (
    <>
      {todos.length > 0 ? t.content.todosLeft(left.length) : null}
      <button className="island-widget-open todo-widget__add" type="button" aria-label={text.todoIsland.widgetAdd} title={text.todoIsland.widgetAdd} aria-pressed={adding} onClick={clickOnly(() => (adding ? close() : setAdding(true)))}>
        <Plus size={12} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <WidgetOpenButton label={text.todoIsland.widgetOpen} onOpen={openTodos} />
    </>
  );
  return (
    <WidgetFrame icon={ListTodo} title={t.widgets.todos} aside={aside}>
      {adding ? (
        <input
          className="todo-widget__input"
          autoFocus
          value={draft}
          placeholder={text.todoIsland.addPlaceholder}
          aria-label={text.todoIsland.widgetAdd}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onClick={(event) => event.stopPropagation()}
          onBlur={() => {
            if (!draft.trim()) close();
          }}
        />
      ) : null}
      {shown.length === 0 ? (
        adding ? null : <WidgetEmpty>{t.content.todosEmpty}</WidgetEmpty>
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
                onClick={clickOnly(() => props?.onToggleTodo(todo.id))}
              >
                {todo.completed ? <Check size={10} strokeWidth={3} /> : null}
              </button>
              <button className="todo-widget__title" type="button" title={text.todoIsland.widgetOpen} onClick={clickOnly(openTodos)}>
                {todo.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

widgetSlot.add({ ...TODOS_WIDGET, component: TodosWidget }, TODOS_WIDGET.owner);
