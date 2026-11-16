import type { IslandPageMeta } from "../../plugin-kernel/slots";

export const islandPage = {
  id: "agents",
  order: 90,
  shortcutOrder: 1,
  enabled: (features) => features.agents === true,
} satisfies IslandPageMeta<Readonly<Record<string, unknown>>> & { id: string; order: number };
