import { useId } from "react";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { useTranslation } from "../../i18n";
import { noticeSwitchShown } from "../../lib/plugin-notice-mutes/mutes";
import { usePluginNoticeMutes } from "../../lib/plugin-notice-mutes/usePluginNoticeMutes";
import type { InstalledEntry } from "./pluginEntries";

export function PluginNoticeSwitch({ entry }: { entry: InstalledEntry }) {
  const text = useTranslation().settings.pluginsV3.page.notices;
  const { mutes, senders, setMuted } = usePluginNoticeMutes();
  const id = useId();
  if (!noticeSwitchShown(entry.id, entry.places.includes("alerts"), mutes, senders)) return null;
  const muted = mutes.includes(entry.id);
  return (
    <div className="plugin-notice-switch" data-notice-switch={entry.id} data-muted={muted ? "true" : undefined}>
      <div className="plugin-notice-switch__copy">
        <label className="plugin-notice-switch__label" htmlFor={id}>{text.label}</label>
        <span className="plugin-notice-switch__hint">{muted ? text.off : text.on}</span>
      </div>
      <SettingsSwitch id={id} checked={!muted} ariaLabel={text.aria(entry.title)} onChange={(checked) => setMuted(entry.id, !checked)} />
    </div>
  );
}
