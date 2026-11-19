import { useEffect, useState } from "react";
import { ArrowRight, CircleHelp, LoaderCircle } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { hasQQMailHelp } from "./mailDomain";
import "./MailSettings.css";

const MAIL_PRESETS = [
  { label: "@qq.com", domain: "qq.com", host: "imap.qq.com" },
  { label: "@163.com", domain: "163.com", host: "imap.163.com" },
  { label: "@gmail.com", domain: "gmail.com", host: "imap.gmail.com" },
  { label: "@outlook.com", domain: "outlook.com", host: "outlook.office365.com" },
] as const;

export function MailConnectForm({ reauthorizing, busy, onConnect, onHelp, onCancel }: {
  reauthorizing: string | null;
  busy: boolean;
  onConnect: (email: string, authorizationCode: string, host?: string) => Promise<boolean>;
  onHelp: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslation();
  const [email, setEmail] = useState(reauthorizing ?? "");
  const [authorizationCode, setAuthorizationCode] = useState("");
  const [host, setHost] = useState("");
  const [customHost, setCustomHost] = useState(false);

  useEffect(() => { setEmail(reauthorizing ?? ""); setAuthorizationCode(""); setHost(""); setCustomHost(false); }, [reauthorizing]);

  return (
    <form className="mail-settings__form" onSubmit={(event) => {
      event.preventDefault();
      void onConnect(email, authorizationCode, reauthorizing ? undefined : host).then((connected) => {
        if (!connected) return;
        setAuthorizationCode("");
        if (!reauthorizing) { setEmail(""); setHost(""); }
      });
    }}>
      <label className="mail-settings__row">
        <span>{t.mail.email}</span>
        <input type="email" autoComplete="username" placeholder={t.mail.emailPlaceholder} required maxLength={80} value={email} disabled={busy || reauthorizing !== null} onChange={(event) => setEmail(event.currentTarget.value)} />
      </label>
      {reauthorizing === null && !email.includes("@") && (
        <div className="mail-settings__presets">
          {MAIL_PRESETS.map((preset) => (
            <button
              key={preset.domain}
              className="mail-settings__preset"
              type="button"
              disabled={busy}
              onClick={() => {
                setEmail(`${email.trim()}${preset.label}`);
                if (!host.trim()) setHost(preset.host);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
      <label className="mail-settings__row">
        <span>{t.mail.authorizationCode}</span>
        <input type="password" autoComplete="off" placeholder={t.mail.authorizationPlaceholder} required maxLength={256} value={authorizationCode} disabled={busy} onChange={(event) => setAuthorizationCode(event.currentTarget.value)} />
      </label>
      {reauthorizing === null && customHost && (
        <label className="mail-settings__row">
          <span>{t.mail.imapHost}</span>
          <input type="text" autoComplete="off" spellCheck={false} placeholder={t.mail.imapHostPlaceholder} maxLength={253} value={host} disabled={busy} onChange={(event) => setHost(event.currentTarget.value)} />
        </label>
      )}
      <div className="mail-settings__buttons">
        {hasQQMailHelp(email) && (
          <button className="mail-settings__button" type="button" aria-label={t.mail.helpLabel} onClick={onHelp}>
            <CircleHelp size={13} strokeWidth={2} aria-hidden="true" />{t.mail.help}
          </button>
        )}
        {reauthorizing === null && !customHost && (
          <button className="mail-settings__button mail-settings__button--quiet" type="button" disabled={busy} onClick={() => setCustomHost(true)}>{t.mail.customHost}</button>
        )}
        {onCancel && <button className="mail-settings__button" type="button" disabled={busy} onClick={onCancel}>{t.mail.cancel}</button>}
        <button className="mail-settings__button mail-settings__button--primary" type="submit" disabled={busy || !email.trim() || !authorizationCode.trim()}>
          {busy ? <LoaderCircle size={13} strokeWidth={2} className="mail-settings__spinning" aria-hidden="true" /> : <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />}
          {busy ? t.common.connecting : t.mail.connect}
        </button>
      </div>
    </form>
  );
}
