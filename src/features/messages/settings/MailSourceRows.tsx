import { useState } from "react";
import { Plus } from "lucide-react";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { useTranslation } from "../../../i18n";
import { MessageSourceIcon } from "../MessageSourceIcon";
import { MailAccountList } from "../mail/MailAccountList";
import { MailConnectForm } from "../mail/MailConnectForm";
import { MAX_MAIL_ACCOUNTS } from "../mail/mailAccounts";
import { loadMailAccounts } from "../mail/storage";
import type { useMailAccounts } from "../mail/useMailAccounts";
import { setSourceEnabled } from "../plugin/useSourceSwitches";
import { MessageSourceRow } from "./MessageSourceRow";

export type MailAccountsController = ReturnType<typeof useMailAccounts>;

export function staleMailboxes(mail: MailAccountsController): number {
  return mail.mailboxes.filter((mailbox) => mailbox.status === "authRequired").length;
}

export function MailSourceRows({ enabled, mail }: { enabled: boolean; mail: MailAccountsController }) {
  const t = useTranslation();
  const labels = t.settings.messageSources;
  const { mailboxes, busy, actionError, connect, setEnabled, disconnect, openHelp } = mail;
  const [reauthorizing, setReauthorizing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const hosts = Object.fromEntries(loadMailAccounts().map((account) => [account.email, account.host]));
  const full = mailboxes.length >= MAX_MAIL_ACCOUNTS;
  const target = (reauthorizing ? mailboxes.find((mailbox) => mailbox.email === reauthorizing) : undefined)?.email ?? null;
  const stale = staleMailboxes(mail);
  const showForm = enabled && (target !== null || adding) && !(full && !target);
  const close = () => { setReauthorizing(null); setAdding(false); };

  return (
    <>
      <MessageSourceRow
        kind="mail"
        icon={<MessageSourceIcon source="qqMail" size={20} />}
        name={t.messages.sourceLabels.qqMail}
        enabled={enabled}
        tone={mailboxes.length === 0 ? "off" : stale > 0 ? "warn" : "ok"}
        status={stale > 0 ? labels.mailNeedsCode(mailboxes.length, stale) : labels.mailCount(mailboxes.length)}
        capability={enabled ? undefined : labels.capability.mail}
        onToggle={(on) => void setSourceEnabled("mail", on)}
      />
      {enabled && mailboxes.length > 0 && (
        <div className="settings-row settings-row--indent source-row__accounts" data-search="off">
          <MailAccountList
            mailboxes={mailboxes}
            hosts={hosts}
            busy={busy}
            onSetEnabled={(email, on) => void setEnabled(email, on)}
            onReauthorize={setReauthorizing}
            onDisconnect={(email) => {
              if (email === target) setReauthorizing(null);
              void disconnect(email);
            }}
          />
        </div>
      )}
      {showForm && (
        <SettingsRow searchable={false} indent title={target ? t.mail.reauthorizeTitle(target) : t.mail.addTitle}>
          <MailConnectForm
            reauthorizing={target}
            busy={busy}
            onConnect={async (email, code, host) => {
              const connected = await connect(email, code, host);
              if (connected) close();
              return connected;
            }}
            onHelp={() => void openHelp()}
            onCancel={close}
          />
        </SettingsRow>
      )}
      {enabled && !showForm && (
        <SettingsRow
          searchable={false}
          indent
          title={<span className="messages-settings__muted">{full ? t.mail.limitReached(MAX_MAIL_ACCOUNTS) : mailboxes.length === 0 ? labels.mailEmptyHint : ""}</span>}
          control={full ? undefined : (
            <SettingsLinkButton onClick={() => setAdding(true)}>
              <Plus size={13} strokeWidth={2.2} aria-hidden="true" />
              {t.mail.addTitle}
            </SettingsLinkButton>
          )}
        />
      )}
      {enabled && actionError && (
        <SettingsRow searchable={false} indent title={<span className="messages-settings__error" role="alert">{actionError}</span>} />
      )}
    </>
  );
}
