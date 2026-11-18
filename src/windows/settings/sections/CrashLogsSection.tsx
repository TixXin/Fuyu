import { useEffect, useState } from "react";
import { FileText, FolderOpen } from "lucide-react";
import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { useTranslation } from "../../../i18n";
import { isMacOS } from "../../../lib/platform";
import { readCrashLogsHome, revealCrashLogPath, type CrashLogsHome } from "../api";
import { crashLogTarget } from "./crashLogsModel";

export function CrashLogsSection() {
  const text = useTranslation().settings.generalLogs;
  const [info, setInfo] = useState<CrashLogsHome | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readCrashLogsHome()
      .then((current) => {
        if (!cancelled && current) setInfo(current);
      })
      .catch((error: unknown) => console.error("Failed to read crash log info", error));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info) return null;
  const target = crashLogTarget(info.home, info.crashLog);
  const actionLabel = target.hasLog
    ? (isMacOS ? text.locateMac : text.locate)
    : (isMacOS ? text.openDirMac : text.openDir);

  return (
    <SettingsGroup footer={<SettingsFootnote text={isMacOS ? text.hintMac : text.hint} />}>
      <SettingsRow
        title={text.title}
        description={<span data-search="off">{target.fileName ? text.latest(target.fileName) : text.none}</span>}
        control={
          <SettingsLinkButton onClick={() => void revealCrashLogPath(target.path)}>
            {target.hasLog ? (
              <FileText size={13} strokeWidth={2.2} aria-hidden="true" />
            ) : (
              <FolderOpen size={13} strokeWidth={2.2} aria-hidden="true" />
            )}
            {actionLabel}
          </SettingsLinkButton>
        }
      />
    </SettingsGroup>
  );
}
