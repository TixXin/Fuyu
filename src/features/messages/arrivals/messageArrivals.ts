import type { MessagePreview } from "../messagePreview.ts";

export const MAX_ARRIVALS = 6;

export type ArrivalMessage = MessagePreview & {
  actions: { id: string; title: string }[];
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
