import { defineSlot, type IslandCollapsedMeta, type IslandNoticeMeta, type IslandPageMeta } from "../../plugin-kernel/slots";
import { ReminderNotice, ReminderNoticeActions } from "../ReminderNotice";
import { TimerNotice, TimerNoticeActions } from "../TimerNotice";
import type { Timer } from "../timers";
import type { ShownReminder } from "../useIslandReminder";
import { TIMER_CHIP_WIDTH, TimerChip } from "../TimerChip";
import { TimerPanel } from "../TimerPanel";
import { islandPage } from "./page.ts";

type TimerPageProps = { mode: string };

const pageSlot = defineSlot<TimerPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function TimerPage({ mode }: TimerPageProps) {
  return <TimerPanel isOpen={mode === "expanded"} />;
}

pageSlot.add({ ...islandPage, component: TimerPage });

type GaugeContext = { paused: boolean; timer: { enabled: boolean; running: boolean } };

const gaugeSlot = defineSlot<GaugeContext, IslandCollapsedMeta<GaugeContext>>("island.collapsed/v1");

gaugeSlot.add({ id: "timer", order: 70, group: "gauges", width: TIMER_CHIP_WIDTH, hideable: true, shown: ({ timer }) => timer.enabled && timer.running, component: TimerChip });

type NoticeSources = { ringing: readonly Timer[]; reminder: ShownReminder | null };

const noticeSlot = defineSlot<NoticeSources, IslandNoticeMeta<NoticeSources>>("island.notice/v1");

function RingingContent({ ringing }: NoticeSources) {
  return <TimerNotice ringing={ringing} />;
}

function ReminderContent({ reminder }: NoticeSources) {
  return reminder && <ReminderNotice key={reminder.current.id} reminder={reminder} />;
}

function ReminderActions({ reminder }: NoticeSources) {
  return reminder && <ReminderNoticeActions reminder={reminder} />;
}

noticeSlot.add({ id: "timer", order: 30, active: ({ ringing }) => ringing.length > 0, component: RingingContent, actions: TimerNoticeActions });
noticeSlot.add({ id: "reminder", order: 60, active: ({ reminder }) => Boolean(reminder), component: ReminderContent, actions: ReminderActions });
