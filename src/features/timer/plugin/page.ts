import { Timer } from "lucide-react";
import type { IslandPageMeta } from "../../plugin-kernel/slots";

export const islandPage = {
  id: "timer",
  order: 70,
  icon: Timer,
  headerDot: true,
  shortcutOrder: 8,
  enabled: (features) => features.timer === true,
} satisfies IslandPageMeta<Readonly<Record<string, unknown>>> & { id: string; order: number };
