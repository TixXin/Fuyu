import { SettingsGroup } from "../../components/settings/SettingsGroup";
import type { SystemPermissionKind } from "../../features/system-permissions/api";
import { PermissionRows } from "../../features/system-permissions/PermissionRows";
import { useSystemPermissions } from "../../features/system-permissions/useSystemPermissions";
import { useTranslation } from "../../i18n";
import { ActHeading } from "./ActHeading";
import type { OnboardingModule } from "./personas";

export function neededPermissions(modules: ReadonlySet<OnboardingModule>): SystemPermissionKind[] {
  const kinds: SystemPermissionKind[] = [];
  if (modules.has("clipboard") || modules.has("translation")) kinds.push("accessibility");
  if (modules.has("screenshot")) kinds.push("screenRecording");
  return kinds;
}

export function PermissionsAct({ kinds }: { kinds: readonly SystemPermissionKind[] }) {
  const text = useTranslation().onboarding.permissions;
  const { permissions, refresh } = useSystemPermissions();
  const shown = permissions.filter((permission) => kinds.includes(permission.kind));
  const allGranted = shown.length > 0 && shown.every((permission) => permission.granted);
  return (
    <>
      <ActHeading title={text.title} lead={allGranted ? text.allGranted : text.lead} />
      <SettingsGroup>
        <PermissionRows permissions={shown} onAsked={refresh} />
      </SettingsGroup>
      <p className="onboarding-release__later">{text.later}</p>
    </>
  );
}
