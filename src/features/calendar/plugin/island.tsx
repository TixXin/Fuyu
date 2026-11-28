import { lazy, useState } from "react";
import { defineSlot, type IslandNoticeMeta, type IslandPageMeta } from "../../plugin-kernel/slots";
import { MeetingBannerActions, MeetingBannerNotice } from "../MeetingBannerNotice";
import { useCalendarDayRequest } from "./dayRequest";
import { calendarState, meetingBannerState, todoLinkState } from "./islandState";
import { islandPage } from "./page.ts";
import { OWNER } from "./owner.ts";

const CalendarPanel = lazy(() => import("../CalendarPanel").then((m) => ({ default: m.CalendarPanel })));

type CalendarPageProps = {
  onOpenSettings: (section: "calendar") => void;
};

const REQUEST_FRESH_MS = 3_000;

const pageSlot = defineSlot<CalendarPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function CalendarPage({ onOpenSettings }: CalendarPageProps) {
  const calendar = calendarState.use();
  const link = todoLinkState.use() ?? undefined;
  const asked = useCalendarDayRequest();
  const [openedAt] = useState(Date.now);
  const request = asked && asked.at >= openedAt - REQUEST_FRESH_MS ? asked : null;
  if (!calendar) return null;
  return (
    <CalendarPanel
      key={request?.at ?? 0}
      initialDay={request?.day ?? null}
      snapshot={calendar.snapshot}
      failure={calendar.failure}
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
