import { defineSlot, type IslandPageMeta } from "../../plugin-kernel/slots";
import { TodoIslandPage } from "../island/TodoIslandPage";
import { todosIsland } from "./islandState";
import { islandPage } from "./page.ts";

type TodoPageProps = {
  settings: { enableTodoReorder: boolean };
  todoScrollStartRows: number;
};

const pageSlot = defineSlot<TodoPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function TodoPage({ settings, todoScrollStartRows }: TodoPageProps) {
  const notebookProps = todosIsland.use()?.notebookProps;
  if (!notebookProps) return null;
  return (
    <TodoIslandPage
      {...notebookProps}
      enableTodoReorder={settings.enableTodoReorder}
      scrollStartRows={todoScrollStartRows}
    />
  );
}

pageSlot.add({ ...islandPage, component: TodoPage });
