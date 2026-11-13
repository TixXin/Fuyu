import { useState, type CSSProperties, type MouseEvent } from "react";
import { ExternalLink, Lock, Settings2, Trash2 } from "lucide-react";
import { ToggleControl } from "../../components/controls/ToggleControl";
import { useLocale, useTranslation } from "../../i18n";
import { openPluginHomepage, PLUGIN_PERMISSIONS, type PluginInfo, type PluginPermission } from "./api";
import { isSensitivePermission } from "./promptedPermissions";
import { pluginHealth } from "./installedFilter";
import { PluginIcon } from "./PluginIcon";
import { PluginNotes } from "./PluginNotes";
import "./PluginCard.css";
import { isMacOS } from "../../lib/platform";

const isPermission = (name: string): name is PluginPermission =>
  (PLUGIN_PERMISSIONS as readonly string[]).includes(name);

function PermissionSummary({ permissions, optional }: { permissions: string[]; optional: string[] }) {
  const t = useTranslation();
  if (permissions.length + optional.length === 0) {
    return <span className="plugin-card__permissions-none">{t.settings.plugins.noPermissions}</span>;
  }
  const hasSensitive = permissions.some(isSensitivePermission);
  const item = (permission: string, isOptional: boolean) => (
    <li key={permission} className={isSensitivePermission(permission) ? "plugin-card__permission--sensitive" : undefined}>
      {isPermission(permission) ? (isMacOS && permission === "secrets" ? t.settings.plugins.secretsPermissionMac : t.settings.plugins.permission[permission]) : permission}
      {isOptional ? ` (${t.settings.plugins.optionalPermission})` : ""}
    </li>
  );

  return (
    <details className={`plugin-card__permissions${hasSensitive ? " plugin-card__permissions--sensitive" : ""}`}>
      <summary>
        <Lock size={11} strokeWidth={2.4} />
        <span>{t.settings.plugins.permissionCount(permissions.length + optional.length)}</span>
      </summary>
      <ul>
        {permissions.map((permission) => item(permission, false))}
        {optional.map((permission) => item(permission, true))}
      </ul>
    </details>
  );
}

const OWN_CLICK = "button, a, input, label, summary, details";

export function PluginCard({
  plugin,
  index = 0,
  allowed,
  nodeAvailable,
  powershellAvailable,
  busy,
  onEnabledChange,
  onOpenDetail,
  onUninstall,
}: {
  plugin: PluginInfo;
  index?: number;
  allowed: boolean;
  nodeAvailable: boolean;
  powershellAvailable: boolean;
  busy: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onOpenDetail: () => void;
  onUninstall: () => void;
}) {
  const [confirmingUninstall, setConfirmingUninstall] = useState(false);
  const t = useTranslation();
  const { locale } = useLocale();
  const name = plugin.name?.[locale] ?? plugin.id;
  const isOn = plugin.enabled && !plugin.needsApproval;
  const canRun = allowed || plugin.builtin || plugin.dev;
  const showStatus = plugin.hasProcess && canRun && isOn;
  const description = plugin.description?.[locale];
  const invalid = Boolean(plugin.invalidReason);
  const canUninstall = !plugin.builtin && !plugin.dev;
  const health = pluginHealth(plugin, allowed);
  const openFromCard = (event: MouseEvent<HTMLElement>) => {
    if (invalid || (event.target as Element).closest(OWN_CLICK)) return;
    onOpenDetail();
  };

  return (
    <article
      className={`plugin-card plugin-card--${health}${invalid ? "" : " plugin-card--openable"}`}
      style={{ "--plugin-card-index": Math.min(index, 8) } as CSSProperties}
      onClick={openFromCard}
    >
      <header className="plugin-card__header">
        <PluginIcon id={plugin.id} name={name} health={health} />
        <div className="plugin-card__title">
          <div className="plugin-card__name">
            <strong>{name}</strong>
            {showStatus && plugin.status !== "running" ? (
              <span className={`plugin-card__status plugin-card__status--${plugin.status}`}>
                {t.settings.plugins.status[plugin.status]}
              </span>
            ) : null}
          </div>
          <span>
            {[
              plugin.builtin && t.settings.plugins.builtin,
              plugin.dev && t.settings.plugins.dev.badge,
              plugin.version && `v${plugin.version}`,
              plugin.authorKey && t.settings.plugins.market.signed,
              plugin.author && t.settings.plugins.by(plugin.author),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
        {plugin.dev || invalid ? null : (
          <div className="plugin-card__switch">
            <ToggleControl label={t.settings.plugins.enable} checked={isOn} onChange={(enabled) => !busy && onEnabledChange(enabled)} />
          </div>
        )}
      </header>

      {invalid ? (
        <p className="plugin-card__error">
          {t.settings.plugins.invalid}: {plugin.invalidReason}
        </p>
      ) : (
        <>
          {description ? (
            <p className="plugin-card__description">
              {description}
            </p>
          ) : null}
          <PluginNotes plugin={plugin} allowed={allowed} nodeAvailable={nodeAvailable} powershellAvailable={powershellAvailable} />
        </>
      )}

      <footer className="plugin-card__footer">
        {invalid ? <span /> : <PermissionSummary permissions={plugin.permissions} optional={plugin.optionalPermissions ?? []} />}
        <div className="plugin-card__actions">
          {invalid ? null : (
            <button className="plugin-card__button" type="button" onClick={onOpenDetail}>
              <Settings2 size={12} strokeWidth={2.4} />
              <span>{t.settings.plugins.detail.open}</span>
            </button>
          )}
          {!invalid && plugin.homepage.startsWith("https://") ? (
            <button
              className="plugin-card__button plugin-card__button--icon"
              type="button"
              aria-label={t.settings.plugins.homepage}
              onClick={() => void openPluginHomepage(plugin.homepage)}
            >
              <ExternalLink size={12} strokeWidth={2.4} />
            </button>
          ) : null}
          {canUninstall ? (
            <button
              className={`plugin-card__button ${confirmingUninstall ? "plugin-card__button--danger" : "plugin-card__button--quiet plugin-card__button--icon"}`}
              type="button"
              aria-label={confirmingUninstall ? undefined : t.settings.plugins.uninstall}
              disabled={busy}
              onBlur={() => setConfirmingUninstall(false)}
              onClick={() => (confirmingUninstall ? onUninstall() : setConfirmingUninstall(true))}
            >
              <Trash2 size={12} strokeWidth={2.4} />
              {confirmingUninstall ? <span>{t.settings.plugins.confirmUninstall}</span> : null}
            </button>
          ) : null}
        </div>
      </footer>
    </article>
  );
}
