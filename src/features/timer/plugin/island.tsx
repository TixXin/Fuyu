import { defineSlot, type IslandCollapsedMeta, type IslandNoticeMeta, type IslandPageMeta } from "../../plugin-kernel/slots";
import { ReminderNotice, ReminderNoticeActions } from "../ReminderNotice";
import { TimerNotice, TimerNoticeActions } from "../TimerNotice";
import { TIMER_CHIP_WIDTH, TimerChip } from "../TimerChip";
import { TimerPanel } from "../TimerPanel";
import { islandPage } from "./page.ts";
import { timerIsland } from "./islandState";
import { OWNER } from "./owner.ts";

type TimerPageProps = { mode: string };

const pageSlot = defineSlot<TimerPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function TimerPage({ mode }: TimerPageProps) {
  return <TimerPanel isOpen={mode === "expanded"} />;
}

pageSlot.add({ ...islandPage, component: TimerPage }, OWNER);

type GaugeContext = { paused: boolean; timer: { enabled: boolean; running: boolean } };

const gaugeSlot = defineSlot<GaugeContext, IslandCollapsedMeta<GaugeContext>>("island.collapsed/v1");

gaugeSlot.add({ id: "timer", order: 70, group: "gauges", width: TIMER_CHIP_WIDTH, hideable: true, shown: ({ timer }) => timer.enabled && timer.running, component: TimerChip }, OWNER);

const noticeSlot = defineSlot<object, IslandNoticeMeta<object>>("island.notice/v1");

function RingingContent() {
  return <TimerNotice ringing={timerIsland.use().ringing} />;
}

function ReminderContent() {
  const { reminder } = timerIsland.use();
  return reminder && <ReminderNotice key={reminder.current.id} reminder={reminder} />;
}

function ReminderActions() {
  const { reminder } = timerIsland.use();
  return reminder && <ReminderNoticeActions reminder={reminder} />;
}

noticeSlot.add({ id: "timer", order: 30, component: RingingContent, actions: TimerNoticeActions }, OWNER);
noticeSlot.add({ id: "reminder", order: 60, component: ReminderContent, actions: ReminderActions }, OWNER);
