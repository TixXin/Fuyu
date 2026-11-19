import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { usePluginNoticeMutes } from "../../lib/plugin-notice-mutes/usePluginNoticeMutes";
import { OWNER } from "./plugin/owner.ts";
import { localApiSenders } from "./senders.ts";

export function LocalApiSenders() {
  const t = useTranslation().settings.localApi;
  const { mutes, senders, setMuted } = usePluginNoticeMutes();
  const sources = localApiSenders(OWNER, senders, mutes);
  if (sources.length === 0) return null;

  return (
    <SettingsGroup title={t.sendersTitle} footer={<SettingsFootnote text={t.sendersHint} />}>
      {sources.map(({ id, source, muted }) => (
        <SettingsToggleRow
          key={id}
          title={source}
          description={muted ? t.senderMuted : t.senderOn}
          checked={!muted}
          searchable={false}
          onChange={(checked) => setMuted(id, !checked)}
        />
      ))}
    </SettingsGroup>
  );
}
