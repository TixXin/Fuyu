import { ClipboardList } from "lucide-react";
import type { IslandPageMeta } from "../../plugin-kernel/slots";

export const islandPage = {
  id: "clipboard",
  order: 40,
  icon: ClipboardList,
  headerDot: true,
  shortcutOrder: 5,
  enabled: (features) => features.clipboard === true,
} satisfies IslandPageMeta<Readonly<Record<string, unknown>>> & { id: string; order: number };
