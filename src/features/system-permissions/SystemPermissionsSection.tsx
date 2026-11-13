import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { useTranslation } from "../../i18n";
import { PermissionRows } from "./PermissionRows";
import { useSystemPermissions } from "./useSystemPermissions";

export function SystemPermissionsSection() {
  const text = useTranslation().settings.permissions;
  const { permissions, refresh } = useSystemPermissions();
  if (permissions.length === 0) return null;
  return (
    <SettingsGroup title={text.title} footer={<p>{text.hint}</p>}>
      <PermissionRows permissions={permissions} onAsked={refresh} />
    </SettingsGroup>
  );
}
