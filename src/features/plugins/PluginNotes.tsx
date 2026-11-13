import { useLocale, useTranslation } from "../../i18n";
import type { PluginInfo } from "./api";
import { PluginRunStats } from "./PluginRunStats";
import { RuntimeHints } from "./RuntimeHints";

export function PluginNotes({ plugin, allowed, nodeAvailable, powershellAvailable }: {
  plugin: PluginInfo;
  allowed: boolean;
  nodeAvailable: boolean;
  powershellAvailable: boolean;
}) {
  const t = useTranslation();
  const { locale } = useLocale();
  const text = t.settings.plugins;
  const isOn = plugin.enabled && !plugin.needsApproval;
  const canRun = allowed || plugin.builtin || plugin.dev;
  const showStatus = plugin.hasProcess && canRun && isOn;

  return (
    <div className="plugin-card__notes">
      {plugin.revoked ? <p className="plugin-card__error">{text.updates.revoked(plugin.revoked[locale])}</p> : null}
      {plugin.autoUpdated ? <p className="plugin-card__hint">{text.updates.autoUpdated(plugin.autoUpdated)}</p> : null}
      {plugin.updateFailed ? <p className="plugin-card__error">{text.updates.autoUpdateFailed(plugin.updateFailed)}</p> : null}
      {plugin.updateAvailable && plugin.updateAvailable !== plugin.autoUpdated ? (
        <p className={plugin.signingKeyChanged ? "plugin-card__hint plugin-card__hint--warn" : "plugin-card__hint plugin-card__hint--info"}>
          {plugin.signingKeyChanged ? text.updates.keyChanged(plugin.updateAvailable) : text.updates.available(plugin.updateAvailable)}
        </p>
      ) : null}
      {plugin.preReleaseAvailable && !plugin.preRelease ? <p className="plugin-card__hint">{text.updates.preReleaseOffered(plugin.preReleaseAvailable)}</p> : null}
      {plugin.needsApproval ? <p className="plugin-card__hint plugin-card__hint--warn">{text.needsApproval}</p> : null}
      {isOn && !canRun ? <p className="plugin-card__hint plugin-card__hint--warn">{text.notAllowed}</p> : null}
      {!plugin.hasProcess ? <p className="plugin-card__hint">{text.describedOnly}</p> : null}
      <RuntimeHints runtime={plugin.runtime} platforms={plugin.platforms} nodeAvailable={nodeAvailable} powershellAvailable={powershellAvailable} />
      {showStatus && plugin.error ? <p className="plugin-card__error">{plugin.error}</p> : null}
      {showStatus ? <PluginRunStats plugin={plugin} /> : null}
      {plugin.keybindingConflicts.length > 0 ? (
        <p className="plugin-card__hint plugin-card__hint--warn">{text.keybindingConflict(plugin.keybindingConflicts.join(", "))}</p>
      ) : null}
    </div>
  );
}
