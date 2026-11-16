import { Inbox } from "lucide-react";
import type { IslandPageMeta } from "../../plugin-kernel/slots";

export const islandPage = {
  id: "shelf",
  order: 50,
  icon: Inbox,
  headerDot: true,
  shortcutOrder: 6,
  enabled: (features) => features.shelf === true,
} satisfies IslandPageMeta<Readonly<Record<string, unknown>>> & { id: string; order: number };
