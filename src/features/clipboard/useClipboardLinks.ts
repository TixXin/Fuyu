import { useCallback, useEffect, useState } from "react";
import {
  addClipboardLink,
  getClipboardLinks,
  listenClipboardLinksChanged,
  moveClipboardLink,
  removeClipboardLink,
  setClipboardLinkSettings,
  type ClipboardLinkSettings,
  type ClipboardLinks,
} from "./api";
import { DEFAULT_CLIPBOARD_LINKS, normalizeClipboardLinks } from "./linkRules.ts";

export function useClipboardLinks() {
  const [links, setLinks] = useState<ClipboardLinks>(DEFAULT_CLIPBOARD_LINKS);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    void getClipboardLinks().then((next) => { if (!cancelled) setLinks(normalizeClipboardLinks(next)); }, (failure: unknown) => { if (!cancelled) setError(failure); });
    void listenClipboardLinksChanged((next) => setLinks(normalizeClipboardLinks(next))).then((unlisten) => {
      if (cancelled) unlisten();
      else stop = unlisten;
    }).catch((failure: unknown) => console.error("Failed to listen for bookmark changes", failure));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const run = useCallback((request: Promise<ClipboardLinks>) => request.then((next) => {
    setLinks(normalizeClipboardLinks(next));
    setError(null);
    return true;
  }, (failure: unknown) => {
    setError(failure);
    return false;
  }), []);

  return {
    links,
    error,
    add: useCallback((url: string, title?: string) => run(addClipboardLink(url, title)), [run]),
    remove: useCallback((id: string) => run(removeClipboardLink(id)), [run]),
    move: useCallback((id: string, to: number) => run(moveClipboardLink(id, to)), [run]),
    setSettings: useCallback((settings: ClipboardLinkSettings) => run(setClipboardLinkSettings(settings)), [run]),
  };
}

export type ClipboardLinksState = ReturnType<typeof useClipboardLinks>;
