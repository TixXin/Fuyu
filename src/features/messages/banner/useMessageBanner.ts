import { useCallback, useEffect, useState } from "react";
import { addBannerMessage, bannerKey, sameBannerActions, type BannerMessage, type BannerState } from "./bannerMessages.ts";

export function useMessageBanner<T extends BannerMessage>(enabled: boolean, incoming: T | null, paused: boolean) {
  const [banner, setBanner] = useState<BannerState<T> | null>(null);
  const [seenKey, setSeenKey] = useState<string | null>(null);
  const key = incoming ? bannerKey(incoming) : null;

  if (enabled && incoming && key !== seenKey) {
    setSeenKey(key);
    setBanner((current) => addBannerMessage(current, incoming));
  } else if (enabled && incoming && banner && bannerKey(banner.message) === key && !sameBannerActions(banner.message.actions, incoming.actions)) {
    setBanner((current) => (current ? addBannerMessage(current, incoming) : null));
  }
  if (!enabled && banner) setBanner(null);

  const activeVersion = banner?.version ?? null;
  const durationMs = banner?.message.durationMs ?? 0;

  useEffect(() => {
    if (activeVersion === null || paused) return;
    const timer = window.setTimeout(() => setBanner(null), durationMs);
    return () => window.clearTimeout(timer);
  }, [activeVersion, durationMs, paused]);

  const close = useCallback(() => setBanner(null), []);
  return { banner, close };
}
