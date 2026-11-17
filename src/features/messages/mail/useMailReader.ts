import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import type { Translations } from "../../../i18n";
import { errorText } from "../../../i18n/nativeError";
import { openMailLink, readMailContent, type MailContent, type MailMessage } from "./api";

const MAX_PREFETCHED = 8;

function cacheKey(account: string, messageId: string): string {
  return `${account}\0${messageId}`;
}

export function useMailReader(t: Translations, onOpen: () => void, onError: (message: string) => void) {
  const [selectedMail, setSelectedMail] = useState<MailMessage | null>(null);
  const [readerAccount, setReaderAccount] = useState<string | null>(null);
  const [content, setContent] = useState<MailContent | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const prefetchedRef = useRef<Map<string, MailContent>>(new Map());

  useEffect(() => {
    const requests = requestRef;
    return () => { ++requests.current; };
  }, []);

  const clearAccountPrefetch = useCallback((account: string | null) => {
    if (!account) return;
    const prefix = `${account}\0`;
    for (const key of Array.from(prefetchedRef.current.keys())) {
      if (key.startsWith(prefix)) prefetchedRef.current.delete(key);
    }
  }, []);

  const prefetchMail = useCallback(async (account: string, messageId: string): Promise<MailContent | null> => {
    if (!isTauri()) return null;
    const key = cacheKey(account, messageId);
    const existing = prefetchedRef.current.get(key);
    if (existing) return existing;
    try {
      const next = await readMailContent(account, messageId);
      if (next.id !== messageId) return null;
      if (prefetchedRef.current.size >= MAX_PREFETCHED) {
        const oldest = prefetchedRef.current.keys().next().value;
        if (oldest !== undefined) prefetchedRef.current.delete(oldest);
      }
      prefetchedRef.current.set(key, next);
      return next;
    } catch {
      return null;
    }
  }, []);

  const closeReader = useCallback(() => {
    ++requestRef.current;
    setSelectedMail(null);
    setReaderAccount(null);
    setContent(null);
    setReadError(null);
    setReading(false);
  }, []);

  const readMail = useCallback(async (account: string, message: MailMessage) => {
    const requestId = ++requestRef.current;
    setSelectedMail(message);
    setReaderAccount(account);
    setContent(null);
    setReadError(null);
    onOpen();
    if (!isTauri()) { setReadError(t.mail.desktopRead); setReading(false); return false; }
    const key = cacheKey(account, message.id);
    const prefetched = prefetchedRef.current.get(key);
    if (prefetched && prefetched.id === message.id) {
      prefetchedRef.current.delete(key);
      setContent(prefetched);
      setReading(false);
      return true;
    }
    setReading(true);
    try {
      const next = await readMailContent(account, message.id);
      if (requestId !== requestRef.current) return false;
      if (next.id !== message.id) throw new Error(t.mail.changed);
      setContent(next);
      return true;
    } catch (error) {
      if (requestId === requestRef.current) setReadError(errorText(error, t));
      return false;
    } finally {
      if (requestId === requestRef.current) setReading(false);
    }
  }, [onOpen, t]);

  const openLink = useCallback(async (href: string) => {
    if (!/^https?:\/\//i.test(href)) return;
    try { await openMailLink(href); }
    catch { onError(t.mail.openLinkFailed); }
  }, [onError, t]);

  return { selectedMail, readerAccount, content, reading, readError, readMail, prefetchMail, clearAccountPrefetch, closeReader, openLink };
}
