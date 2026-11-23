import { ListTodo } from "lucide-react";
import type { BuiltinWidget } from "../../plugin-kernel/widgetCatalog";
import { OWNER } from "./owner.ts";

export const TODOS_WIDGET: BuiltinWidget = { id: "todos", icon: ListTodo, owner: OWNER, group: "todos", sizes: ["m", "l"], order: 10, label: (t) => t.islandWidgets.widgets.todos };

export const OPEN_TODOS_ACTION = "todos.open-page";

export const islandWidgets: readonly BuiltinWidget[] = [TODOS_WIDGET];
