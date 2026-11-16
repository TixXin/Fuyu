import type { Reminder } from "@fuyu/plugin-services";

const ICONS: ReadonlySet<string> = new Set(["stand", "eye", "water", "stretch", "coffee", "bell", "flag"]);

export function readReminder(params: unknown): Reminder | null {
  if (typeof params !== "object" || params === null) return null;
  const { id, source, icon, title, detail, snoozable } = params as Record<string, unknown>;
  if (typeof id !== "string" || !id || typeof source !== "string" || typeof title !== "string" || typeof icon !== "string" || !ICONS.has(icon)) return null;
  return {
    id,
    source,
    icon: icon as Reminder["icon"],
    title,
    ...(typeof detail === "string" ? { detail } : {}),
    ...(typeof snoozable === "boolean" ? { snoozable } : {}),
  };
}
