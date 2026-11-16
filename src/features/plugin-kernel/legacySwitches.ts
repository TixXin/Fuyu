import type { IslandSettings } from "../../lib/settings/types";
import type { BuiltinPlugin } from "./api.ts";

export type SwitchTarget = string | { readonly plugin: string; readonly key: string };

export const LEGACY_SWITCHES = {
  todoEnabled: "todos",
  translationEnabled: "translation",
  calendarEnabled: "calendar",
  shelfEnabled: "file-shelf",
  musicEnabled: "music",
  agentStatusEnabled: "agents",
  deviceAlerts: "device-events",
  levelPopup: "system-levels",
  deviceUseIndicator: "device-use",
  mailEnabled: { plugin: "messages", key: "mail" },
} as const satisfies Partial<Record<keyof IslandSettings, SwitchTarget>>;

export type LegacySwitch = keyof typeof LEGACY_SWITCHES;

type Switches = Partial<Record<LegacySwitch, boolean>>;

const FIELDS = Object.keys(LEGACY_SWITCHES) as LegacySwitch[];

const TARGETS: Record<LegacySwitch, SwitchTarget> = LEGACY_SWITCHES;

function pluginOf(plugins: readonly BuiltinPlugin[] | null, target: SwitchTarget) {
  const id = typeof target === "string" ? target : target.plugin;
  return plugins?.find((plugin) => plugin.id === id);
}

export function switchOf(plugins: readonly BuiltinPlugin[] | null, field: LegacySwitch): boolean | undefined {
  const target = TARGETS[field];
  const plugin = pluginOf(plugins, target);
  if (!plugin || typeof target === "string") return plugin?.enabled;
  const value = plugin.config[target.key];
  return typeof value === "boolean" ? value : undefined;
}

export function withSwitches<S extends Switches>(settings: S, plugins: readonly BuiltinPlugin[] | null): S {
  let next = settings;
  for (const field of FIELDS) {
    const on = switchOf(plugins, field);
    if (on !== undefined && settings[field] !== on) next = { ...next, [field]: on };
  }
  return next;
}

export function switchChanges(before: Switches, after: Switches): [SwitchTarget, boolean][] {
  return FIELDS.filter((field) => typeof after[field] === "boolean" && after[field] !== before[field]).map((field) => [TARGETS[field], after[field] as boolean]);
}

export interface ReconcileState {
  stored: Switches;
  switched: Switches;
}

export interface Reconciled {
  switch: [SwitchTarget, boolean][];
  mirror: Partial<Record<LegacySwitch, boolean>>;
  migrated: LegacySwitch[];
  seen: ReconcileState;
}

export function reconcile(settings: Switches, plugins: readonly BuiltinPlugin[], seen: ReconcileState | null, migrated: ReadonlySet<string>): Reconciled {
  const result: Reconciled = { switch: [], mirror: {}, migrated: [], seen: { stored: {}, switched: {} } };
  for (const field of FIELDS) {
    const stored = settings[field];
    const on = switchOf(plugins, field);
    result.seen.stored[field] = stored;
    result.seen.switched[field] = on;
    if (typeof stored !== "boolean" || !pluginOf(plugins, TARGETS[field])) continue;
    if (on === undefined) {
      result.switch.push([TARGETS[field], stored]);
      if (!migrated.has(field)) result.migrated.push(field);
      continue;
    }
    if (!migrated.has(field)) {
      result.migrated.push(field);
      if (!stored && on) result.switch.push([TARGETS[field], false]);
      else if (stored !== on) result.mirror[field] = on;
      continue;
    }
    if (stored === on) continue;
    if (seen && stored !== seen.stored[field]) result.switch.push([TARGETS[field], stored]);
    else result.mirror[field] = on;
  }
  return result;
}
