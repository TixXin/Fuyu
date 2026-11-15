import { useCallback, useEffect, useRef, useState } from "react";
import { listenClipboardItemCopied, type ClipboardHistoryItem } from "./api";
import { itemLink, offeredLink } from "./linkRules.ts";
import { useClipboardLinks } from "./useClipboardLinks";

const LINK_SECONDS = 6;

type Card = { item: ClipboardHistoryItem; key: number; link: URL | null; offered: boolean };

export function useClipboardCopyCard(enabled: boolean) {
  const links = useClipboardLinks();
  const [current, setCurrent] = useState<Card | null>(null);
  const [saved, setSaved] = useState<"saved" | "failed" | null>(null);
  const timer = useRef(0);
  const shownFor = useRef(0);
  const settings = useRef(links.links.settings);
  useEffect(() => { settings.current = links.links.settings; }, [links.links.settings]);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setCurrent(null);
  }, []);
  const release = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCurrent(null), shownFor.current);
  }, []);
  const hold = useCallback(() => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    void listenClipboardItemCopied(({ item, seconds, origin }) => {
      const offered = origin === "capture" ? offeredLink(item, settings.current) : null;
      if (origin === "capture" ? !offered : seconds <= 0) return;
      shownFor.current = (offered ? Math.max(seconds, LINK_SECONDS) : seconds) * 1000;
      setSaved(null);
      setCurrent({ item, key: Date.now(), link: offered ?? itemLink(item), offered: offered !== null });
      release();
    }).then((unlisten) => {
      if (cancelled) unlisten();
      else stop = unlisten;
    }).catch((error: unknown) => console.error("Failed to listen for clipboard copies", error));
    return () => {
      cancelled = true;
      stop?.();
      window.clearTimeout(timer.current);
      setCurrent(null);
    };
  }, [enabled, release]);

  const link = current?.link ?? null;
  const known = link !== null && links.links.links.some((saved) => saved.url === link.href);
  const bookmark = useCallback(() => {
    if (!link) return;
    void links.add(link.href).then((ok) => setSaved(ok ? "saved" : "failed"));
  }, [link, links]);

  return { current, dismiss, hold, release, bookmark, bookmarked: known || saved === "saved", bookmarkFailed: saved === "failed" };
}

export type ClipboardCopyCardState = ReturnType<typeof useClipboardCopyCard>;
