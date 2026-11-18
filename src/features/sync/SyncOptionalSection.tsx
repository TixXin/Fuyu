import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import type { OptionalSyncGroup } from "./api";
import { OPTIONAL_GROUP_ITEMS } from "./syncState";

export function SyncOptionalSection({
  enabledGroups,
  busy,
  onToggle,
}: {
  enabledGroups: readonly OptionalSyncGroup[];
  busy: boolean;
  onToggle: (group: OptionalSyncGroup, checked: boolean) => void;
}) {
  const text = useTranslation().sync.optional;
  const enabled = new Set(enabledGroups);

  return (
    <SettingsGroup
      title={text.groupTitle}
      footer={<SettingsFootnote text={text.footnote} />}
    >
      {OPTIONAL_GROUP_ITEMS.map((group) => {
        const copy = text.items[group];
        return (
          <SettingsToggleRow
            key={group}
            title={copy.title}
            description={copy.description}
            checked={enabled.has(group)}
            disabled={busy}
            onChange={(checked) => onToggle(group, checked)}
          />
        );
      })}
    </SettingsGroup>
  );
}
