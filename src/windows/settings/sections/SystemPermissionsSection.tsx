import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { useTranslation } from "../../../i18n";
import { PermissionRows } from "../../../components/settings/PermissionRows";
import { useSystemPermissions } from "../../../lib/system-permissions/useSystemPermissions";

export function SystemPermissionsSection() {
  const text = useTranslation().settings.permissions;
  const { permissions, refresh } = useSystemPermissions();
  if (permissions.length === 0) return null;
  return (
    <SettingsGroup title={text.title} footer={<SettingsFootnote text={text.hint} />}>
      <PermissionRows permissions={permissions} onAsked={refresh} />
    </SettingsGroup>
  );
}
