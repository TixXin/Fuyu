import { Cloud, FolderSync, HardDrive, Share2 } from "lucide-react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";

export function SyncHelpSection() {
  const text = useTranslation().sync.help;
  const guides = [
    { key: "cloudDrive", icon: Cloud, copy: text.items.cloudDrive },
    { key: "nutstore", icon: FolderSync, copy: text.items.nutstore },
    { key: "syncthing", icon: Share2, copy: text.items.syncthing },
    { key: "nas", icon: HardDrive, copy: text.items.nas },
  ] as const;

  return (
    <SettingsGroup
      title={text.groupTitle}
      footer={<SettingsFootnote text={text.footnote} />}
    >
      {guides.map(({ key, icon: Icon, copy }) => (
        <SettingsRow
          key={key}
          searchable={false}
          title={
            <span className="sync-help__title">
              <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>{copy.title}</span>
            </span>
          }
          description={copy.description}
        />
      ))}
    </SettingsGroup>
  );
}
