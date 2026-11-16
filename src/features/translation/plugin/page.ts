import type { IslandPageMeta } from "../../plugin-kernel/slots";

export const islandPage = {
  id: "translation",
  order: 100,
  shortcutOrder: 10,
  enabled: (features) => features.translation === true,
} satisfies IslandPageMeta<Readonly<Record<string, unknown>>> & { id: string; order: number };
