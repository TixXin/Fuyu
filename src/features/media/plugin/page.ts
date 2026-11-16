import { Music } from "lucide-react";
import type { IslandPageMeta } from "../../plugin-kernel/slots";

export const islandPage = {
  id: "music",
  order: 30,
  icon: Music,
  headerDot: true,
  shortcutOrder: 3,
  enabled: (features) => features.music === true,
} satisfies IslandPageMeta<Readonly<Record<string, unknown>>> & { id: string; order: number };
