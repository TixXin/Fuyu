import { defineSlot, type IslandNoticeMeta, type IslandPageMeta } from "../../plugin-kernel/slots";
import { CalendarPanel } from "../CalendarPanel";
import { MeetingBannerActions, MeetingBannerNotice } from "../MeetingBannerNotice";
import { calendarState, meetingBannerState, todoLinkState } from "./islandState";
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
    <CalendarPanel
      snapshot={calendar.snapshot}
      now={calendar.now}
      onRefresh={calendar.refresh}
      onOpenSettings={() => onOpenSettings("calendar")}
      todos={link}
    />
  );
}

pageSlot.add({ ...islandPage, component: CalendarPage }, OWNER);

const noticeSlot = defineSlot<object, IslandNoticeMeta<object>>("island.notice/v1");

function BannerContent() {
  const active = meetingBannerState.use();
  return active ? <MeetingBannerNotice key={active.banner.id} banner={active.banner} /> : null;
}

function BannerActions() {
  const active = meetingBannerState.use();
  return active ? (
    <MeetingBannerActions
      banner={active.banner}
      pauseMediaOnJoin={active.pauseMediaOnJoin}
      onDismiss={active.dismiss}
    />
  ) : null;
}

noticeSlot.add({ id: "calendar.banner", order: 55, component: BannerContent, actions: BannerActions }, OWNER);
