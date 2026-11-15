import { Bell, Coffee, Eye, Flag, GlassWater, PersonStanding, Accessibility, type LucideIcon } from "lucide-react";
import type { ReminderIcon } from "./reminderQueue";

export const REMINDER_ICONS: Readonly<Record<ReminderIcon, LucideIcon>> = {
  stand: PersonStanding,
  eye: Eye,
  water: GlassWater,
  stretch: Accessibility,
  coffee: Coffee,
  bell: Bell,
  flag: Flag,
};
