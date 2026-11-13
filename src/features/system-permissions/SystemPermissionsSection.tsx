import { useCallback, useEffect, useState } from "react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import { getSystemPermissions, openSystemPermission, type SystemPermission } from "./api";

export function SystemPermissionsSection() {
  const text = useTranslation().settings.permissions;
  const [permissions, setPermissions] = useState<SystemPermission[]>([]);

  const refresh = useCallback(() => {
    void getSystemPermissions()
      .then((list) => setPermissions(Array.isArray(list) ? list : []))
      .catch((error: unknown) => console.error("Failed to read the system permissions", error));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  if (permissions.length === 0) return null;

  return (
    <SettingsGroup title={text.title} footer={<p>{text.hint}</p>}>
      {permissions.map(({ kind, granted }) => (
        <SettingsRow
          key={kind}
          title={text.kinds[kind].title}
          description={`${granted ? text.granted : text.missing} · ${text.kinds[kind].description}`}
          control={
            granted ? null : (
              <SettingsLinkButton onClick={() => void openSystemPermission(kind).catch((error: unknown) => console.error(error))}>{text.open}</SettingsLinkButton>
            )
          }
        />
      ))}
    </SettingsGroup>
  );
}
