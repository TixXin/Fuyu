import type { ComponentProps } from "react";
import { defineSlot, type IslandPageMeta } from "../../plugin-kernel/slots";
import { CalendarPanel } from "../CalendarPanel";
import type { CalendarState } from "../useCalendar";
import { islandPage } from "./page.ts";

type TodoLink = NonNullable<ComponentProps<typeof CalendarPanel>["todos"]>;

type CalendarPageProps = {
  calendar: CalendarState;
  addTodoOn?: TodoLink["onAdd"];
  notebookProps: { scheduledTodos: TodoLink["scheduled"] };
  onOpenSettings: (section: "calendar") => void;
};

const pageSlot = defineSlot<CalendarPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function CalendarPage({ calendar, addTodoOn, notebookProps, onOpenSettings }: CalendarPageProps) {
  return (
    <CalendarPanel snapshot={calendar.snapshot} now={calendar.now} onRefresh={calendar.refresh} onOpenSettings={() => onOpenSettings("calendar")}
      todos={addTodoOn && { scheduled: notebookProps.scheduledTodos, onAdd: addTodoOn }} />
  );
}

pageSlot.add({ ...islandPage, component: CalendarPage });
