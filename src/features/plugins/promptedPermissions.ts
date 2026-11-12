import { PLUGIN_PERMISSIONS, type PluginInfo, type PluginPermission } from "./api";

export const SENSITIVE_PERMISSIONS = ["clipboard:read", "messages:read", "media:read", "shelf:read", "shelf:write"] as const;
export type SensitivePermission = (typeof SENSITIVE_PERMISSIONS)[number];
export type PluginSensitiveChoice = "allowed" | "denied";
export const isSensitivePermission = (name: string): name is SensitivePermission =>
  (SENSITIVE_PERMISSIONS as readonly string[]).includes(name);
export const PLUGIN_URI_PERMISSION = "uri";
export type PromptedPermission = PluginPermission | typeof PLUGIN_URI_PERMISSION;
const isPluginPermission = (name: string): name is PluginPermission => (PLUGIN_PERMISSIONS as readonly string[]).includes(name);

export function promptedPermissions(plugin: Pick<PluginInfo, "permissions" | "activationEvents"> & { optionalPermissions?: string[] }): PromptedPermission[] {
  const prompted: PromptedPermission[] = plugin.permissions.filter(isSensitivePermission);
  for (const name of plugin.optionalPermissions ?? []) {
    if (isPluginPermission(name) && !prompted.includes(name)) prompted.push(name);
  }
  if (plugin.activationEvents.includes("onUri")) prompted.push(PLUGIN_URI_PERMISSION);
  return prompted;
}
