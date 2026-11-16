import { defineSlot, type IslandPageMeta } from "../../plugin-kernel/slots";
import { TodoIslandPage } from "../island/TodoIslandPage";
import type { useTodos } from "../useTodos";
import { islandPage } from "./page.ts";

type TodoPageProps = {
  notebookProps: ReturnType<typeof useTodos>["notebookProps"];
  settings: { enableTodoReorder: boolean };
  todoScrollStartRows: number;
};

const pageSlot = defineSlot<TodoPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function TodoPage({ notebookProps, settings, todoScrollStartRows }: TodoPageProps) {
  return (
    <TodoIslandPage
      {...notebookProps}
      enableTodoReorder={settings.enableTodoReorder}
      scrollStartRows={todoScrollStartRows}
    />
  );
}

pageSlot.add({ ...islandPage, component: TodoPage });
