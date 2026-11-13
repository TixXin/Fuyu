import type { World } from "../../app/world";
import { copyFor as sharedCopy } from "../001-one-island/copy";
import { clips, lrc } from "../001-one-island/seed";
import type { Lang } from "../types";
import { copyFor } from "./copy";

const minute = 60_000;

export function todayAt(hour: number, minutes = 0) {
  const date = new Date();
  date.setHours(hour, minutes, 0, 0);
  return date.getTime();
}

function today() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function seed(world: World, lang: Lang) {
  const copy = copyFor(lang);
  const shared = sharedCopy(lang);
  const now = Date.now();
  world.settings = { calendarRemindMinutes: 0 };
  world.todos = {
    date: today(),
    todos: copy.todos.map((title, index) => ({ id: `t${index}`, title, completed: false, createdAt: now - index * minute })),
    scheduled: [], archives: [], dailyNote: "", activeTodoId: null,
  };
  const slots = [[10, 0, 90, "https://meet.example.com/weekly"], [15, 0, 60, null], [19, 30, 60, null]] as const;
  world.calendar = copy.events.map((event, index) => {
    const [hour, minutes, length, link] = slots[index];
    const startMs = todayAt(hour, minutes);
    return {
      uid: `e${index}`, title: event.title, startMs, endMs: startMs + length * minute, allDay: false,
      location: event.location || null, meetingLink: link, calendar: event.calendar,
    };
  });
  world.lyrics[shared.song.title] = { source: "local", lrc: lrc(shared) };
  world.clipboard = clips(shared, now);
  world.translations[shared.translate.source] = shared.translate.result;
  world.audioPeak = () => 0.32 + 0.28 * Math.abs(Math.sin(Date.now() / 173)) + 0.18 * Math.abs(Math.sin(Date.now() / 61));
}
