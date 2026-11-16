import type { IslandSettings } from "../../lib/settings/types";
import type { BuiltinPlugin } from "./api.ts";

export const LEGACY_SWITCHES = {
  todoEnabled: "todos",
  translationEnabled: "translation",
  calendarEnabled: "calendar",
  shelfEnabled: "file-shelf",
  musicEnabled: "music",
  deviceAlerts: "device-events",
  levelPopup: "system-levels",
  deviceUseIndicator: "device-use",
} as const satisfies Partial<Record<keyof IslandSettings, string>>;

export type LegacySwitch = keyof typeof LEGACY_SWITCHES;

type Switches = Partial<Record<LegacySwitch, boolean>>;

const FIELDS = Object.keys(LEGACY_SWITCHES) as LegacySwitch[];

export function switchOf(plugins: readonly BuiltinPlugin[] | null, field: LegacySwitch): boolean | undefined {
  return plugins?.find((plugin) => plugin.id === LEGACY_SWITCHES[field])?.enabled;
}

export function withSwitches<S extends Switches>(settings: S, plugins: readonly BuiltinPlugin[] | null): S {
  let next = settings;
  for (const field of FIELDS) {
    const on = switchOf(plugins, field);
    if (on !== undefined && settings[field] !== on) next = { ...next, [field]: on };
  }
  return next;
}

export function switchChanges(before: Switches, after: Switches): [string, boolean][] {
  return FIELDS.filter((field) => typeof after[field] === "boolean" && after[field] !== before[field]).map((field) => [LEGACY_SWITCHES[field], after[field] as boolean]);
}

export interface ReconcileState {
  stored: Switches;
  switched: Switches;
}

export interface Reconciled {
  switch: [string, boolean][];
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
    if (typeof stored !== "boolean" || on === undefined) continue;
    if (!migrated.has(field)) {
      result.migrated.push(field);
      if (!stored && on) result.switch.push([LEGACY_SWITCHES[field], false]);
      else if (stored !== on) result.mirror[field] = on;
      continue;
    }
    if (stored === on) continue;
    if (seen && stored !== seen.stored[field]) result.switch.push([LEGACY_SWITCHES[field], stored]);
    else result.mirror[field] = on;
  }
  return result;
}
