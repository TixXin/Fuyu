import { useTranslation } from "../../../i18n";
import { errorText } from "../../../i18n/nativeError";
import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getMailState, invokeMailCommand, listenMailChanged, openMailLink, type MailEvent, type MailSnapshot, type MailCommand } from "./api";
import { loadMailAccounts, saveMailAccounts } from "./storage";
import { orderMailboxes, rememberMailbox, totalUnread, upsertMailbox } from "./mailAccounts";

export function useMailAccounts({ restore, onSnapshot, onEvent }: {
  restore: boolean;
  onSnapshot?: (snapshot: MailSnapshot) => void;
  onEvent?: (event: MailEvent) => void;
}) {
  const t = useTranslation();
  const translationsRef = useRef(t);
  translationsRef.current = t;
  const [mailboxes, setMailboxes] = useState<MailSnapshot[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(isTauri);
  const revisionsRef = useRef(new Map<string, number>());
  const typedHostsRef = useRef(new Map<string, string>());
  const actionIdRef = useRef(0);
  const onSnapshotRef = useRef(onSnapshot);
  onSnapshotRef.current = onSnapshot;
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const acceptSnapshot = useCallback((next: MailSnapshot, persist = true) => {
    const email = next.email;
    if (!email || next.revision < (revisionsRef.current.get(email) ?? -1)) return false;
    revisionsRef.current.set(email, next.revision);
    onSnapshotRef.current?.(next);
    setMailboxes((current) => upsertMailbox(current, next));
    if (next.status === "connected" && !next.syncing) setActionError(null);
    if (persist) {
      try { saveMailAccounts(rememberMailbox(loadMailAccounts(), next, typedHostsRef.current.get(email))); }
      catch { setActionError(translationsRef.current.mail.savePreferencesFailed); }
    }
    return true;
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      unlisten = await listenMailChanged(({ payload }) => {
        if (!cancelled && acceptSnapshot(payload.snapshot)) onEventRef.current?.(payload);
      });
      if (cancelled) { unlisten(); return; }
      const saved = loadMailAccounts();
      const current = await getMailState();
      if (cancelled) return;
      for (const snapshot of orderMailboxes(current, saved)) acceptSnapshot(snapshot, false);
      if (!restore) return;
      for (const account of saved) {
        if (current.some((snapshot) => snapshot.email === account.email)) continue;
        try {
          const restored = await invokeMailCommand("set_qq_mail_enabled", { email: account.email, enabled: account.enabled, host: account.host || null });
          if (cancelled) return;
          acceptSnapshot(restored);
        } catch (error) { if (!cancelled) setActionError(errorText(error, translationsRef.current)); }
      }
    })().catch((error: unknown) => {
      if (!cancelled) setActionError(errorText(error, translationsRef.current));
    }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; unlisten?.(); };
  }, [acceptSnapshot, restore]);

  const run = useCallback(async (command: MailCommand, args: Record<string, unknown>) => {
    if (!isTauri()) { setActionError(t.mail.desktopConnect); return false; }
    const id = ++actionIdRef.current;
    setBusy(true);
    setActionError(null);
    try {
      const next = await invokeMailCommand(command, args);
      return id === actionIdRef.current && acceptSnapshot(next);
    } catch (error) {
      if (id === actionIdRef.current) setActionError(errorText(error, t));
      return false;
    } finally { if (id === actionIdRef.current) setBusy(false); }
  }, [acceptSnapshot, t]);

  const savedHost = (email: string | null) => loadMailAccounts().find((account) => account.email === email)?.host || null;

  const connect = useCallback((email: string, authorizationCode: string, host?: string) => {
    const key = email.trim().toLowerCase();
    if (host?.trim()) typedHostsRef.current.set(key, host.trim());
    return run("connect_qq_mail", { email, authorizationCode, host: host?.trim() || savedHost(key) });
  }, [run]);
  const setEnabled = useCallback((email: string, enabled: boolean) =>
    run("set_qq_mail_enabled", { email, enabled, host: savedHost(email) }), [run]);
  const setAllEnabled = useCallback(async (enabled: boolean) => {
    for (const mailbox of mailboxes) {
      if (mailbox.email && mailbox.configured && mailbox.enabled !== enabled) await setEnabled(mailbox.email, enabled);
    }
  }, [mailboxes, setEnabled]);
  const refresh = useCallback((email: string) => run("refresh_qq_mail", { email }), [run]);
  const disconnect = useCallback((email: string) => run("disconnect_qq_mail", { email }), [run]);
  const markRead = useCallback((email: string, messageId: string) => run("mark_qq_mail_read", { email, messageId }), [run]);
  const openHelp = useCallback(async () => {
    try { await openMailLink("https://service.mail.qq.com/"); }
    catch { setActionError(t.mail.helpFailed); }
  }, [t]);

  return {
    mailboxes, busy, actionError, setActionError, connect, setEnabled, setAllEnabled, refresh, disconnect, markRead, openHelp,
    unreadTotal: totalUnread(mailboxes),
    anyConfigured: mailboxes.some((mailbox) => mailbox.configured),
    anyReceiving: mailboxes.some((mailbox) => mailbox.configured && mailbox.enabled),
  };
}

export type MailAccountsController = ReturnType<typeof useMailAccounts>;
