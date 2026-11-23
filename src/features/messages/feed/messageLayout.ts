export const MESSAGE_LAYOUTS = ["focus", "inbox", "reader", "stacks", "board", "timeline"] as const;

export type MessageLayout = (typeof MESSAGE_LAYOUTS)[number];

export const DEFAULT_MESSAGE_LAYOUT: MessageLayout = "reader";

export const MESSAGE_LAYOUT_CONFIG_KEY = "layout";

export function normalizeMessageLayout(value: unknown): MessageLayout {
  return typeof value === "string" && (MESSAGE_LAYOUTS as readonly string[]).includes(value) ? value as MessageLayout : DEFAULT_MESSAGE_LAYOUT;
}
