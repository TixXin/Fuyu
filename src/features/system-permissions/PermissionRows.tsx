import { useState } from "react";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import { restartIsland } from "../settings-backup/api";
import { requestSystemPermission, type SystemPermission, type SystemPermissionKind } from "./api";

export function PermissionRows({ permissions, onAsked }: { permissions: SystemPermission[]; onAsked: () => void }) {
  const text = useTranslation().settings.permissions;
  const [asked, setAsked] = useState<ReadonlySet<SystemPermissionKind>>(new Set());

  const ask = (kind: SystemPermissionKind) => {
    setAsked(new Set([...asked, kind]));
    void requestSystemPermission(kind)
      .catch((error: unknown) => console.error("Failed to ask for the permission", error))
      .finally(onAsked);
  };

  return (
    <>
      {permissions.map(({ kind, granted }) => {
        const waitingForRestart = !granted && kind === "screenRecording" && asked.has(kind);
        return (
          <SettingsRow
            key={kind}
            title={text.kinds[kind].title}
            description={`${granted ? text.granted : waitingForRestart ? text.restartNeeded : text.missing} · ${text.kinds[kind].description}`}
            control={
              granted ? null : waitingForRestart ? (
                <SettingsLinkButton onClick={() => void restartIsland().catch((error: unknown) => console.error(error))}>{text.restart}</SettingsLinkButton>
              ) : (
                <SettingsLinkButton onClick={() => ask(kind)}>{asked.has(kind) ? text.openAgain : text.allow}</SettingsLinkButton>
              )
            }
          />
        );
      })}
    </>
  );
}
