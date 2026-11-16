import { ListTodo } from "lucide-react";
import type { IslandPageMeta } from "../../plugin-kernel/slots";

export const islandPage = {
  id: "todo",
  order: 10,
  icon: ListTodo,
  headerDot: true,
  shortcutOrder: 2,
  enabled: (features) => features.todo === true,
} satisfies IslandPageMeta<Readonly<Record<string, unknown>>> & { id: string; order: number };
