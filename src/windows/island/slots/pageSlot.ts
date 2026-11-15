import { CalendarDays, ClipboardList, Images, Inbox, ListTodo, Music, Timer } from "lucide-react";
import { defineSlot, type IslandPageMeta } from "../../../features/plugin-kernel/slots.ts";
import type { IslandFeatures } from "../features";
import type { IslandPagesProps } from "../IslandPages";
import type { BuiltinPage } from "../types";

type PageMeta = IslandPageMeta<IslandFeatures, BuiltinPage>;

export const pageSlot = defineSlot<IslandPagesProps, PageMeta>("island.page/v1");

const switchedOn = (page: BuiltinPage) => (features: IslandFeatures) => features[page] === true;

export const BUILTIN_PAGES = [
  { id: "todo", icon: ListTodo, headerDot: true, shortcutOrder: 2, enabled: switchedOn("todo") },
  { id: "calendar", icon: CalendarDays, headerDot: true, shortcutOrder: 4, enabled: switchedOn("calendar") },
  { id: "music", icon: Music, headerDot: true, shortcutOrder: 3, enabled: switchedOn("music") },
  { id: "clipboard", icon: ClipboardList, headerDot: true, shortcutOrder: 5, enabled: switchedOn("clipboard") },
  { id: "shelf", icon: Inbox, headerDot: true, shortcutOrder: 6, enabled: switchedOn("shelf") },
  { id: "screenshots", icon: Images, headerDot: true, shortcutOrder: 7, enabled: switchedOn("screenshots"), fallback: (features) => (features.clipboardScreenshots ? "clipboard" : null) },
  { id: "timer", icon: Timer, headerDot: true, shortcutOrder: 8, enabled: switchedOn("timer") },
  { id: "qq", shortcutOrder: 9, enabled: (features) => features.qq || features.wechat || features.qqMail },
  { id: "agents", shortcutOrder: 1, enabled: switchedOn("agents") },
  { id: "translation", shortcutOrder: 10, enabled: switchedOn("translation") },
] satisfies readonly (PageMeta & { id: BuiltinPage })[];

export type HeaderDotPage = Extract<(typeof BUILTIN_PAGES)[number], { headerDot: true }>["id"];
