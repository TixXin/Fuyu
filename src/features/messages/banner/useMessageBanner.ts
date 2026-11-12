import { useCallback, useEffect, useState } from "react";
import { addBannerMessage, bannerKey, type BannerMessage, type BannerState } from "./bannerMessages.ts";

export function useMessageBanner<T extends BannerMessage>(enabled: boolean, incoming: T | null, paused: boolean) {
  const [banner, setBanner] = useState<BannerState<T> | null>(null);
  const [seenKey, setSeenKey] = useState<string | null>(null);
  const key = incoming ? bannerKey(incoming) : null;

  if (enabled && incoming && key !== seenKey) {
    setSeenKey(key);
    setBanner((current) => addBannerMessage(current, incoming));
  }
  if (!enabled && banner) setBanner(null);

  useEffect(() => {
    if (!banner || paused) return;
    const timer = window.setTimeout(() => setBanner(null), banner.message.durationMs);
    return () => window.clearTimeout(timer);
  }, [banner, paused]);

  const close = useCallback(() => setBanner(null), []);
  return { banner, close };
}
