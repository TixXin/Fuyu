import { Bot, Copy, Inbox, ListTodo, NotebookPen, Pin, Share2, Sparkles, WandSparkles, type LucideIcon } from "lucide-react";
import type { ScreenshotActionIcon } from "./host/actions.mjs";

export const ACTION_ICONS: Record<ScreenshotActionIcon, LucideIcon> = {
  inbox: Inbox,
  bot: Bot,
  sparkles: Sparkles,
  share: Share2,
  copy: Copy,
  pin: Pin,
  wand: WandSparkles,
  notebook: NotebookPen,
  "list-todo": ListTodo,
};
