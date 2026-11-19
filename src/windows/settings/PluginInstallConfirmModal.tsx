import { Info, KeyRound, LoaderCircle, ShieldCheck, TriangleAlert, X } from "lucide-react";
import type { PluginInstallConfirmation } from "@fuyu/plugin-services";
import { useLocale, useTranslation } from "../../i18n";
import { pluginInitial } from "./InstalledPluginRow";
import { PluginMarketDialog } from "./PluginMarketDialog";
import { PluginMarketPermissions } from "./PluginMarketPermissions";
import { localized, permissionItems } from "./pluginMarketModel";
import "./PluginPage.css";

export interface PendingPluginInstall {
  id: string;
  version: string;
  kind: "install" | "update" | "file";
  confirmation: PluginInstallConfirmation;
  fresh?: boolean;
  publisher?: string;
  firstFromPublisher?: boolean;
  fileName?: string;
  sha256?: string;
  manualAllowed?: boolean;
}

const shortHash = (hash: string) => (hash.length > 12 ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : hash);

export function PluginInstallConfirmModal({ pending, busy, error, nameOf, onConfirm, onCancel }: {
  pending: PendingPluginInstall;
  busy: boolean;
  error: string | null;
  nameOf?: (id: string) => string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { locale } = useLocale();
  const text = useTranslation().settings.pluginsV3.marketPage;
  const copy = text.confirm;
  const { id, version, kind, confirmation } = pending;
  const name = localized(confirmation.displayName, locale, id);
  const description = localized(confirmation.description, locale, "");
  const keyChanged = kind === "update" && Boolean(confirmation.trustChange);
  const firstTime = kind === "install" && Boolean(pending.firstFromPublisher) && !confirmation.official;
  const title = kind === "file" ? copy.file(name) : kind === "update" ? copy.update(name, version) : copy.install(name);
  const source = confirmation.official ? copy.official : kind === "file" ? copy.localFile : pending.publisher || copy.localFile;
  const confirmLabel = kind === "file" ? copy.confirmFile : keyChanged ? copy.confirmKey : kind === "update" ? copy.confirmUpdate : firstTime ? copy.confirmTrust : copy.confirmInstall;

  return (
    <PluginMarketDialog label={title} size="small" busy={busy} onClose={onCancel} data={{ "data-install-modal": id, "data-install-kind": kind }}>
      <div className="plugin-dialog__head">
        <span className="plugin-icon plugin-icon--lg" aria-hidden="true">{pluginInitial(name)}</span>
        <div className="plugin-dialog__heading">
          <span className="plugin-dialog__title market-dialog__title">{title}</span>
          <span className="plugin-dialog__sub">{`${source} · ${id}`}</span>
        </div>
        <div className="plugin-dialog__head-actions">
          <button className="plugin-icon-btn" type="button" disabled={busy} aria-label={text.detail.close} title={text.detail.close} onClick={onCancel}>
            <X size={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="plugin-dialog__body">
        {description ? <p className="plugin-dialog__desc">{description}</p> : null}
        {kind === "file" ? (
          <>
            <div className="plugin-callout plugin-callout--warn" data-callout="unreviewed">
              <TriangleAlert size={15} strokeWidth={2.2} aria-hidden="true" />
              <div><b>{copy.fileTitle}</b><br />{pending.fileName ? copy.fileBody(pending.fileName) : copy.fileBodyUnknown}</div>
            </div>
            <div className="plugin-facts">
              <div><span>{copy.facts.version}</span><b>{`v${version}`}</b></div>
              {pending.sha256 ? <div><span>{copy.facts.sha256}</span><b className="market-mono" title={pending.sha256}>{shortHash(pending.sha256)}</b></div> : null}
            </div>
            <p className="plugin-callout" data-callout="manual">
              <Info size={15} strokeWidth={2.2} aria-hidden="true" />
              <span>{pending.manualAllowed ? copy.manualOn : copy.manualOff}</span>
            </p>
          </>
        ) : null}
        {keyChanged ? (
          <div className="plugin-callout plugin-callout--warn" data-callout="key" data-trust-change={confirmation.trustChange}>
            <KeyRound size={15} strokeWidth={2.2} aria-hidden="true" />
            <div><b>{copy.keyTitle}</b><br />{copy.keyBody}</div>
          </div>
        ) : null}
        {firstTime ? (
          <div className="plugin-callout plugin-callout--info" data-callout="first">
            <ShieldCheck size={15} strokeWidth={2.2} aria-hidden="true" />
            <div><b>{copy.firstTitle(pending.publisher ?? id)}</b><br />{copy.firstBody}</div>
          </div>
        ) : null}
        {pending.fresh && kind !== "file" ? (
          <p className="plugin-callout" data-callout="fresh">
            <Info size={15} strokeWidth={2.2} aria-hidden="true" />
            <span>{kind === "update" ? copy.freshUpdate : copy.freshInstall}</span>
          </p>
        ) : null}
        <h3 className="plugin-page__heading">
          {kind === "update" ? text.perms.newVersionCan : text.perms.itCan}
          {kind === "update" ? <span className="plugin-page__heading-meta">{copy.updateNote}</span> : null}
        </h3>
        <PluginMarketPermissions items={permissionItems(confirmation)} nameOf={nameOf} />
        <p className="plugin-foot">{copy.securityNote}</p>
        {error ? <p className="plugin-callout plugin-callout--bad" role="alert">{error}</p> : null}
      </div>
      <div className="plugin-dialog__foot">
        <span className="plugin-dialog__grow" />
        <button className="plugin-btn" type="button" disabled={busy} data-autofocus onClick={onCancel}>
          {kind === "update" ? copy.notNow : copy.cancel}
        </button>
        <button className="plugin-btn plugin-btn--primary" type="button" disabled={busy} data-action="confirm-install" onClick={onConfirm}>
          {busy ? <LoaderCircle className="plugin-spin" size={13} strokeWidth={2.2} aria-hidden="true" /> : null}
          {busy ? copy.installing : confirmLabel}
        </button>
      </div>
    </PluginMarketDialog>
  );
}
