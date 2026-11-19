import type { MessagePreview } from "../messagePreview.ts";

export const MAX_ARRIVALS = 6;

export type ArrivalMessage = MessagePreview & {
  actions: { id: string; title: string }[];
  durationMs?: number;
};

export function arrivalKey(message: MessagePreview): string {
  if (message.source === "wechat" && !message.chat) return "wechat";
  if (message.id) return `${message.source}:${message.id}`;
  return `${message.source}:${message.receivedAt}`;
}

export function sameArrivalActions(
  left: readonly { id: string; title: string }[],
  right: readonly { id: string; title: string }[],
): boolean {
  return left.length === right.length && left.every((item, index) => item.id === right[index]?.id && item.title === right[index]?.title);
}

export function addArrival<T extends ArrivalMessage>(list: readonly T[], message: T): T[] {
  const key = arrivalKey(message);
  const index = list.findIndex((item) => arrivalKey(item) === key);
  if (index >= 0 && list[index].receivedAt === message.receivedAt && list[index].body === message.body && list[index].title === message.title) {
    if (sameArrivalActions(list[index].actions, message.actions)) return list as T[];
    return list.map((item, current) => (current === index ? message : item));
  }
  const filtered = list.filter((item) => arrivalKey(item) !== key && (!message.replacedId || item.id !== message.replacedId));
  return [message, ...filtered].slice(0, MAX_ARRIVALS);
}

export function removeArrival<T extends ArrivalMessage>(list: readonly T[], key: string): T[] {
  return list.filter((item) => arrivalKey(item) !== key);
}

const HEADER_AND_GAP_HEIGHT = 30;
const LIST_ROW_GAP = 6;
const INLINE_ROW_HEIGHT = 46;
const INLINE_ACTIONS_HEIGHT = 32;
const CARD_BASE_HEIGHT = 36;
const CARD_BODY_LINE_HEIGHT = 17;
const CARD_BODY_GAP = 2;
const CARD_ACTIONS_HEIGHT = 33;

export function estimateArrivalsHeight(arrivals: readonly ArrivalMessage[]): number {
  if (arrivals.length === 0) return 0;
  if (arrivals.length === 1 && arrivals[0].inline === true) {
    return INLINE_ROW_HEIGHT + (arrivals[0].actions.length > 0 ? INLINE_ACTIONS_HEIGHT : 0);
  }
  let rowsHeight = 0;
  for (const item of arrivals) {
    const plainWeChat = item.source === "wechat" && !item.chat;
    const isFlash = item.kind === "flash";
    const trimmed = item.body.trim();
    const hasBody = plainWeChat || isFlash || item.source !== "plugin" || trimmed.length > 0;
    const bodyLines = !hasBody ? 0 : !plainWeChat && !isFlash && trimmed.length > 26 ? 2 : 1;
    const bodyHeight = bodyLines > 0 ? CARD_BODY_GAP + bodyLines * CARD_BODY_LINE_HEIGHT : 0;
    const actionsHeight = item.actions.length > 0 ? CARD_ACTIONS_HEIGHT : 0;
    rowsHeight += CARD_BASE_HEIGHT + bodyHeight + actionsHeight;
  }
  return HEADER_AND_GAP_HEIGHT + rowsHeight + (arrivals.length - 1) * LIST_ROW_GAP;
}
