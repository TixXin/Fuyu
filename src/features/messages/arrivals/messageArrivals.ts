import type { MessagePreview } from "../messagePreview";

export const MAX_ARRIVALS = 6;

export type ArrivalMessage = MessagePreview & {
  actions: { id: string; title: string }[];
};

export function arrivalKey(message: MessagePreview): string {
  return message.source === "wechat" && !message.chat ? "wechat" : `${message.source}:${message.receivedAt}`;
}

export function addArrival<T extends ArrivalMessage>(list: readonly T[], message: T): T[] {
  const key = arrivalKey(message);
  const index = list.findIndex((item) => arrivalKey(item) === key);
  if (index >= 0 && list[index].receivedAt === message.receivedAt) return list as T[];
  return [message, ...list.filter((item) => arrivalKey(item) !== key)].slice(0, MAX_ARRIVALS);
}

export function removeArrival<T extends ArrivalMessage>(list: readonly T[], key: string): T[] {
  return list.filter((item) => arrivalKey(item) !== key);
}
