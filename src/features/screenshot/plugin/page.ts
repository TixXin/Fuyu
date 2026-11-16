import { Images } from "lucide-react";
import type { IslandPageMeta } from "../../plugin-kernel/slots";

export const islandPage = {
  id: "screenshots",
  order: 60,
  icon: Images,
  headerDot: true,
  shortcutOrder: 7,
  enabled: (features) => features.screenshots === true,
  fallback: (features) => (features.clipboardScreenshots ? "clipboard" : null),
  fold: { into: "clipboard", when: (features) => features.clipboardScreenshots === true, label: (t) => t.screenshot.history.tab },
} satisfies IslandPageMeta<Readonly<Record<string, unknown>>> & { id: string; order: number };
