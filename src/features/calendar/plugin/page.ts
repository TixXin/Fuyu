import { CalendarDays } from "lucide-react";
import type { IslandPageMeta } from "../../plugin-kernel/slots";

export const islandPage = {
  id: "calendar",
  order: 20,
  icon: CalendarDays,
  headerDot: true,
  shortcutOrder: 4,
  enabled: (features) => features.calendar === true,
} satisfies IslandPageMeta<Readonly<Record<string, unknown>>> & { id: string; order: number };
