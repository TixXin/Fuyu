import { defineSlot, type IslandPageMeta } from "../../plugin-kernel/slots";
import { CalendarPanel } from "../CalendarPanel";
import { todosIsland } from "../../todos/plugin/islandState";
import { calendarState } from "./islandState";
import { islandPage } from "./page.ts";
import { OWNER } from "./owner.ts";

type CalendarPageProps = {
  settings: { todoEnabled: boolean };
  onOpenSettings: (section: "calendar") => void;
};

const pageSlot = defineSlot<CalendarPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function CalendarPage({ settings, onOpenSettings }: CalendarPageProps) {
  const calendar = calendarState.use();
  const todos = todosIsland.use();
  const link = settings.todoEnabled && todos ? { scheduled: todos.notebookProps.scheduledTodos, onAdd: todos.addTodoOn } : undefined;
  if (!calendar) return null;
  return (
    <CalendarPanel snapshot={calendar.snapshot} now={calendar.now} onRefresh={calendar.refresh} onOpenSettings={() => onOpenSettings("calendar")}
      todos={link} />
  );
}

pageSlot.add({ ...islandPage, component: CalendarPage }, OWNER);
