import { useEffect, useState } from "react";
import { getClipboardLinkPreview, type ClipboardLinkPreview } from "./api";

const linkPreviews = new Map<string, Promise<ClipboardLinkPreview | null>>();

export function useLinkPreview(url: string | null, enabled: boolean) {
  const [preview, setPreview] = useState<ClipboardLinkPreview | null>(null);
  useEffect(() => {
    setPreview(null);
    if (!url || !enabled) return;
    let request = linkPreviews.get(url);
    if (!request) {
      request = getClipboardLinkPreview(url).catch(() => null);
      linkPreviews.set(url, request);
    }
    let cancelled = false;
    void request.then((next) => { if (!cancelled) setPreview(next); });
    return () => { cancelled = true; };
  }, [url, enabled]);
  return preview;
}
