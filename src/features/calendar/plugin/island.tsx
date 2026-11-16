import { defineSlot, type IslandPageMeta } from "../../plugin-kernel/slots";
import { CalendarPanel } from "../CalendarPanel";
import { calendarState, todoLinkState } from "./islandState";
import { islandPage } from "./page.ts";
import { OWNER } from "./owner.ts";

type CalendarPageProps = {
  onOpenSettings: (section: "calendar") => void;
};

const pageSlot = defineSlot<CalendarPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function CalendarPage({ onOpenSettings }: CalendarPageProps) {
  const calendar = calendarState.use();
  const link = todoLinkState.use() ?? undefined;
  if (!calendar) return null;
  return (
    <CalendarPanel snapshot={calendar.snapshot} now={calendar.now} onRefresh={calendar.refresh} onOpenSettings={() => onOpenSettings("calendar")}
      todos={link} />
  );
}

pageSlot.add({ ...islandPage, component: CalendarPage }, OWNER);
