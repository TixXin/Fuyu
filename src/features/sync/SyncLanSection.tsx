import { useState } from "react";
import { SettingsInlineConfirm } from "../../components/settings/SettingsInlineConfirm";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useErrorText, useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import type { SyncSectionProps } from "./syncBackends";
import { useSyncLan } from "./useSyncLan";

const CODE_PATTERN = /^\d{6}$/;

export function SyncLanSection({ status, busy }: SyncSectionProps) {
  const t = useTranslation();
  const errorText = useErrorText();
  const text = t.sync.backend.lan;
  const lan = useSyncLan(status);
  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");
  const state = lan.state;
  const disabled = busy || lan.working;
  const platformHint = isMacOS ? text.macHint : text.windowsHint;
  const errorLine = lan.error !== null ? <p className="sync-status__error" role="alert">{errorText(lan.error)}</p> : null;

  if (!lan.active || !state?.running) {
    return (
      <>
        <SettingsRow
          title={t.sync.backend.methods.lan}
          description={text.intro}
          control={
            <button type="button" className="sync-status__button sync-status__button--primary" disabled={disabled} onClick={() => void lan.enable()}>
              <span>{text.enable}</span>
            </button>
          }
        />
        <p className="sync-lan__hint">{platformHint}</p>
        {errorLine}
      </>
    );
  }

  const canJoin = address.trim().length > 0 && CODE_PATTERN.test(code.trim());

  return (
    <>
      <SettingsRow
        title={
          <span className="sync-webdav__label">
            <span>{text.thisDevice}</span>
            <span className="sync-badge sync-badge--ok">{t.sync.backend.webdav.activeBadge}</span>
          </span>
        }
        description={[state.shortId && state.port ? text.thisDeviceHint(state.shortId, state.port) : null, state.announced ? null : text.notAnnounced].filter(Boolean).join(" · ")}
        control={
          state.pairing ? null : (
            <SettingsLinkButton disabled={disabled} onClick={() => void lan.showCode()}>
              {text.showCode}
            </SettingsLinkButton>
          )
        }
      />
      {state.pairing ? (
        <SettingsRow
          title={text.codeTitle}
          description={text.codeHint(state.pairing.secondsLeft)}
          control={
            <div className="sync-folder-actions">
              <strong className="sync-lan__code">{state.pairing.code}</strong>
              <SettingsLinkButton disabled={disabled} onClick={() => void lan.cancelCode()}>
                {text.cancelCode}
              </SettingsLinkButton>
            </div>
          }
        />
      ) : null}
      <SettingsRow title={text.joinTitle} description={text.joinHint}>
        <div className="sync-lan__join">
          <SettingsInput
            aria-label={text.addressLabel}
            monospace
            autoComplete="off"
            value={address}
            placeholder={text.addressPlaceholder}
            onChange={(event) => setAddress(event.currentTarget.value)}
          />
          <SettingsInput
            aria-label={text.codeLabel}
            className="sync-lan__code-input"
            monospace
            inputMode="numeric"
            maxLength={6}
            autoComplete="off"
            value={code}
            placeholder={text.codePlaceholder}
            onChange={(event) => setCode(event.currentTarget.value.replace(/\D/g, ""))}
          />
          <button
            type="button"
            className="sync-status__button sync-status__button--primary"
            disabled={!canJoin || disabled}
            onClick={() => {
              void lan.join(address, code).then((ok) => {
                if (ok) setCode("");
              });
            }}
          >
            <span>{lan.working ? text.joining : text.join}</span>
          </button>
        </div>
      </SettingsRow>
      {state.nearby.map((found) => (
        <SettingsRow
          key={found.deviceId}
          searchable={false}
          title={found.name || found.address}
          description={`${text.nearbyTitle} · ${found.address}`}
          control={<SettingsLinkButton onClick={() => setAddress(found.address)}>{text.nearbyUse}</SettingsLinkButton>}
        />
      ))}
      <SettingsRow title={text.peersTitle} description={state.peers.length === 0 ? text.peersEmpty : undefined} />
      {state.peers.map((peer) => (
        <SettingsRow
          key={peer.fingerprint}
          searchable={false}
          indent
          title={peer.name || peer.deviceId}
          description={text.peerHint(peer.shortId, peer.address)}
          control={
            <SettingsInlineConfirm confirmLabel={text.removeConfirm} disabled={disabled} onConfirm={() => void lan.remove(peer.fingerprint)}>
              {text.remove}
            </SettingsInlineConfirm>
          }
        />
      ))}
      <SettingsToggleRow title={text.clipTitle} description={text.clipHint} checked={state.clipPush} disabled={disabled} onChange={(next) => void lan.setClipPush(next)} />
      <p className="sync-lan__hint">{platformHint}</p>
      {errorLine}
    </>
  );
}
