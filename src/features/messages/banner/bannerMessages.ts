import type { MessagePreview } from "../messagePreview";

export const BANNER_MS = 5_000;

export type BannerMessage = MessagePreview & {
  durationMs: number;
  actions: { id: string; title: string }[];
};

export type BannerState<T extends BannerMessage = BannerMessage> = {
  message: T;
  more: number;
  version: number;
};

export function bannerKey(preview: MessagePreview): string {
  return `${preview.source}:${preview.receivedAt}`;
}

export function addBannerMessage<T extends BannerMessage>(state: BannerState<T> | null, message: T): BannerState<T> {
  if (state && bannerKey(state.message) === bannerKey(message)) return state;
  return { message, more: state ? state.more + 1 : 0, version: (state?.version ?? 0) + 1 };
}

export function bannerClock(receivedAt: number): string {
  const date = new Date(receivedAt);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
