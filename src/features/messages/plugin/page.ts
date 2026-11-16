import type { IslandPageMeta } from "../../plugin-kernel/slots";

export const islandPage = {
  id: "qq",
  order: 80,
  shortcutOrder: 9,
  enabled: (features) => features.qq === true || features.wechat === true || features.qqMail === true,
} satisfies IslandPageMeta<Readonly<Record<string, unknown>>> & { id: string; order: number };
