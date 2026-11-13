import { useState, type ReactNode } from "react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { DataHomeSection } from "./DataHomeSection";
import { SettingsBackupSection } from "./SettingsBackupSection";

export function DataSettingsSection({ onMoved }: { onMoved: (from: string, to: string) => void }) {
  const text = useTranslation().settings;
  const [homeNote, setHomeNote] = useState<ReactNode>(null);
  const [backupNote, setBackupNote] = useState<ReactNode>(null);

  return (
    <SettingsGroup
      title={text.dataHome.groupTitle}
      footer={
        <>
          <SettingsFootnote text={text.dataHome.hint} />
          {homeNote}
          <SettingsFootnote text={isMacOS ? text.backup.hintMac : text.backup.hint} />
          {backupNote}
        </>
      }
    >
      <DataHomeSection onMoved={onMoved} onNote={setHomeNote} />
      <SettingsBackupSection onNote={setBackupNote} />
    </SettingsGroup>
  );
}
