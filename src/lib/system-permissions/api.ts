import { invoke } from "@tauri-apps/api/core";

export type SystemPermissionKind = "accessibility" | "screenRecording";
export type SystemPermission = { kind: SystemPermissionKind; granted: boolean };

export function getSystemPermissions() {
  return invoke<SystemPermission[]>("get_system_permissions");
}

export function requestSystemPermission(kind: SystemPermissionKind) {
  return invoke<boolean>("request_system_permission", { kind });
}

export function openSystemPermission(kind: SystemPermissionKind) {
  return invoke<void>("open_system_permission", { kind });
}
