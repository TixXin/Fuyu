import { ListTodo } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { defineSlot } from "../../plugin-kernel/slots";
import { todoLine } from "./islandState";

type SideContext = {
  onOpenPage: (page: "todo") => void;
};

const sideSlot = defineSlot<SideContext>("island.side/v1");

function TodoRow({ onOpenPage }: SideContext) {
  const t = useTranslation();
  const count = todoLine.use().count ?? 0;
  return (
    <button
      type="button"
      className="island-side-cell"
      aria-label={t.island.pendingTodos(count)}
      onClick={(event) => {
        event.stopPropagation();
        onOpenPage("todo");
      }}
    >
      <ListTodo size={16} strokeWidth={1.6} aria-hidden="true" />
      <span className="island-side-cell__num">{count}</span>
    </button>
  );
}

sideSlot.add({ id: "todo", order: 50, component: TodoRow });
