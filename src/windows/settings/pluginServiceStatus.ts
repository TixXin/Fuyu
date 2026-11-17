import type { BuiltinPlugin } from "../../features/plugin-kernel/api";
import type { BuiltinPluginName, PluginV3State, SettingsPluginsV3Text } from "../../i18n/sections/settings/pluginsV3";
import type { PluginStatusV3 } from "./usePluginHostStatus";

const STATES: readonly PluginV3State[] = ["running", "waiting", "failed", "disabled", "auto-disabled", "safe-mode", "loading", "stopped", "unloading"];

export function stateOf(plugin: PluginStatusV3): PluginV3State {
  return (STATES as readonly string[]).includes(plugin.state) ? (plugin.state as PluginV3State) : "loading";
}

export const BUILTIN_PROVIDES: Readonly<Partial<Record<BuiltinPluginName, readonly string[]>>> = Object.freeze({
  todos: ["todos/v1"],
  calendar: ["calendar/v1"],
  music: ["media/v1", "lyrics/v1"],
  clipboard: ["clipboard/v1"],
  "file-shelf": ["file-shelf/v1"],
  translation: ["translator/v1"],
  timer: ["timers/v1", "reminders/v1"],
  agents: ["agents/v1"],
  "cc-connect": ["cc-connect/v1"],
  messages: ["messages/v1", "island-notices/v1"],
});

const INACTIVE_STATES = new Set<PluginV3State>(["disabled", "failed", "auto-disabled", "safe-mode", "stopped", "unloading"]);

function pluginLabel(id: string, text: SettingsPluginsV3Text): string {
  return (text.builtinNames as Record<string, string | undefined>)[id] ?? id;
}

export function explainWaitingFor(
  waitingFor: readonly string[] | undefined,
  hostPlugins: readonly PluginStatusV3[] | null | undefined,
  builtins: readonly BuiltinPlugin[] | null | undefined,
  text: SettingsPluginsV3Text,
  stateOf: (plugin: PluginStatusV3) => PluginV3State,
): string[] {
  if (!waitingFor || waitingFor.length === 0) return [];
  const reasons = text.waitingReasons;
  if (!reasons) return [text.waitingFor(waitingFor.join(", "))];

  const hostById = new Map((hostPlugins ?? []).map((p) => [p.id, p]));
  const builtinById = new Map((builtins ?? []).map((b) => [b.id, b]));

  return waitingFor.map((service) => {
    let providerId: string | null = null;
    for (const [id, services] of Object.entries(BUILTIN_PROVIDES)) {
      if (services?.includes(service)) {
        providerId = id;
        break;
      }
    }
    if (!providerId && hostPlugins) {
      const found = hostPlugins.find((p) => p.provides?.includes(service));
      if (found) providerId = found.id;
    }
    if (!providerId) return reasons.noProvider(service);

    const label = pluginLabel(providerId, text);
    const hostPlugin = hostById.get(providerId);
    const builtin = builtinById.get(providerId);
    const state: PluginV3State = hostPlugin
      ? stateOf(hostPlugin)
      : builtin
        ? builtin.enabled
          ? "loading"
          : "disabled"
        : "loading";

    if (INACTIVE_STATES.has(state)) {
      return reasons.providerInactive(service, label, text.states[state] ?? state);
    }
    return reasons.providerStarting(service, label);
  });
}

export function explainReplacedServices(
  pluginId: string,
  hostPlugin: PluginStatusV3 | undefined,
  text: SettingsPluginsV3Text,
): string[] {
  const lines: string[] = [];
  const replaced = hostPlugin?.replacedServices ?? [];
  const replacedNames = new Set<string>();
  for (const item of replaced) {
    replacedNames.add(item.service);
    if (text.serviceReplacedBy) {
      lines.push(text.serviceReplacedBy(item.service, pluginLabel(item.by, text)));
    }
  }
  for (const svc of hostPlugin?.disabledServices ?? []) {
    if (!replacedNames.has(svc) && text.serviceYielded) {
      lines.push(text.serviceYielded(svc));
    }
  }
  void pluginId;
  return lines;
}

export type ServiceConflict = {
  service: string;
  existingPluginId: string;
  canYieldOnlyService: boolean;
};

export function detectServiceConflicts(
  candidateId: string,
  candidateProvides: readonly string[],
  builtins: readonly BuiltinPlugin[] | null | undefined,
  hostPlugins: readonly PluginStatusV3[] | null | undefined,
): ServiceConflict[] {
  const conflicts: ServiceConflict[] = [];
  const builtinById = new Map((builtins ?? []).map((b) => [b.id, b]));
  for (const service of candidateProvides) {
    for (const [id, provides] of Object.entries(BUILTIN_PROVIDES)) {
      if (id === candidateId || !provides?.includes(service)) continue;
      const builtin = builtinById.get(id);
      const hostItem = hostPlugins?.find((p) => p.id === id);
      const isEnabled = builtin ? builtin.enabled : hostItem?.state !== "disabled";
      const isYielded = hostItem?.disabledServices?.includes(service) ?? false;
      if (isEnabled && !isYielded) {
        conflicts.push({
          service,
          existingPluginId: id,
          canYieldOnlyService: provides.length > 1,
        });
      }
    }
  }
  return conflicts;
}
