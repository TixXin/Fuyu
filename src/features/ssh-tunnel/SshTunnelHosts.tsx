import { useId, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { useFlash } from "../../components/settings/useFlash";
import { useTranslation } from "../../i18n";
import type { SshTunnelHost } from "./api";
import { exportLine, parseRemotePort } from "./tunnelPort";
import { useSshTunnels, type TakenPort } from "./useSshTunnels";
import "./SshTunnelHosts.css";

export function SshTunnelHosts() {
  const t = useTranslation().settings.plugins.sshTunnel;
  const tunnels = useSshTunnels();

  return (
    <SettingsGroup title={t.title} footer={tunnels.error ? <span className="ssh-tunnel__error">{tunnels.error}</span> : <SettingsFootnote text={t.hint} />}>
      {tunnels.hosts?.length === 0 ? <SettingsRow searchable={false} title={t.empty} /> : null}
      {tunnels.hosts?.map((entry) => (
        <HostRow
          key={entry.host}
          entry={entry}
          checking={tunnels.checking === entry.host}
          question={tunnels.taken?.host === entry.host ? tunnels.taken : null}
          onToggle={(on, port) => tunnels.toggle(entry, on, port)}
          onPort={(port) => tunnels.setPort(entry, port)}
          onAnswer={tunnels.answer}
        />
      ))}
    </SettingsGroup>
  );
}

function HostRow({
  entry,
  checking,
  question,
  onToggle,
  onPort,
  onAnswer,
}: {
  entry: SshTunnelHost;
  checking: boolean;
  question: TakenPort | null;
  onToggle: (on: boolean, port: number | null) => void;
  onPort: (port: number | null) => void;
  onAnswer: (yes: boolean) => void;
}) {
  const text = useTranslation().settings.plugins;
  const t = text.sshTunnel;
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const [invalid, setInvalid] = useState(false);
  const [copied, flashCopied] = useFlash<true>();
  const typed = (then: (port: number | null) => void) => {
    const port = parseRemotePort(field.current?.value ?? "");
    setInvalid(port === "invalid");
    if (port !== "invalid") then(port);
  };
  const state = checking
    ? t.checking
    : entry.remotePort === null
      ? t.needsPort
      : entry.enabled && entry.state === "off"
        ? t.waitingForPlugin
        : t.state[entry.state];
  const line = entry.enabled && entry.remotePort !== null ? exportLine(entry.remotePort) : null;
  const asked =
    question === null
      ? null
      : question.unchecked === null
        ? t.confirm(entry.host, question.port)
        : t.unchecked(entry.host, question.port, question.unchecked);

  return (
    <div className="ssh-tunnel__host">
      <div className="ssh-tunnel__head">
        <label htmlFor={id}>{entry.host}</label>
        <SettingsInput
          key={entry.remotePort ?? ""}
          ref={field}
          className="ssh-tunnel__port"
          inputMode="numeric"
          placeholder={t.port}
          aria-label={`${entry.host} ${t.port}`}
          aria-invalid={invalid}
          defaultValue={entry.remotePort ?? ""}
          onBlur={() => typed(onPort)}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        />
        <SettingsSwitch id={id} checked={entry.enabled} onChange={(on) => typed((port) => onToggle(on, port))} />
      </div>
      <p className={`ssh-tunnel__state ssh-tunnel__state--${checking ? "connecting" : entry.state}`}>
        {invalid ? t.portInvalid : state}
        {entry.state === "error" && entry.error ? <span className="ssh-tunnel__reason">{entry.error}</span> : null}
      </p>
      {asked !== null ? (
        <div className="ssh-tunnel__confirm" role="alertdialog" aria-label={asked}>
          <span>{asked}</span>
          <SettingsLinkButton onClick={() => onAnswer(true)}>{t.yes}</SettingsLinkButton>
          <SettingsLinkButton onClick={() => onAnswer(false)}>{t.no}</SettingsLinkButton>
        </div>
      ) : null}
      {line ? (
        <div className="ssh-tunnel__export">
          <code>{line}</code>
          <SettingsLinkButton onClick={() => void navigator.clipboard.writeText(line).then(() => flashCopied(true))}>
            {copied ? <Check size={12} strokeWidth={2.6} /> : <Copy size={12} strokeWidth={2.4} />}{" "}
            {copied ? text.detail.copied : text.detail.copy}
          </SettingsLinkButton>
        </div>
      ) : null}
    </div>
  );
}
