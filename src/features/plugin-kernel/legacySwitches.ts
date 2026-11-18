import type { IslandSettings } from "../../lib/settings/types";
import type { BuiltinPlugin } from "./api.ts";

export const LEGACY_SWITCHES = {
  todoEnabled: "todos",
  translationEnabled: "translation",
  calendarEnabled: "calendar",
  shelfEnabled: "file-shelf",
  screenshotEnabled: "screenshot",
  musicEnabled: "music",
  agentStatusEnabled: "agents",
  deviceAlerts: "device-events",
  levelPopup: "system-levels",
  deviceUseIndicator: "device-use",
} as const satisfies Partial<Record<keyof IslandSettings, string>>;

export type LegacySwitch = keyof typeof LEGACY_SWITCHES;

type Switches = Partial<Record<LegacySwitch | "mailEnabled", boolean>>;

const FIELDS = Object.keys(LEGACY_SWITCHES) as LegacySwitch[];

export function switchOf(plugins: readonly BuiltinPlugin[] | null, field: LegacySwitch): boolean | undefined {
  const id = LEGACY_SWITCHES[field];
  return plugins?.find((plugin) => plugin.id === id)?.enabled;
}

export function withSwitches<S extends Switches>(settings: S, plugins: readonly BuiltinPlugin[] | null): S {
  let next = settings;
  for (const field of FIELDS) {
    const on = switchOf(plugins, field);
    if (on !== undefined && settings[field] !== on) next = { ...next, [field]: on };
  }
  const mail = plugins?.find((plugin) => plugin.id === "messages")?.config.mail;
  if (typeof mail === "boolean" && "mailEnabled" in settings && settings.mailEnabled !== mail) {
    next = { ...next, mailEnabled: mail };
  }
  return next;
}

export interface MigratedLegacySwitches {
  switch: [string, boolean][];
  migrated: LegacySwitch[];
}

export function migrateLegacySwitches(
  settings: Partial<Record<LegacySwitch, boolean>>,
  plugins: readonly BuiltinPlugin[],
  migrated: ReadonlySet<string>,
): MigratedLegacySwitches {
  const result: MigratedLegacySwitches = { switch: [], migrated: [] };
  for (const field of FIELDS) {
    if (migrated.has(field)) continue;
    const stored = settings[field];
    const id = LEGACY_SWITCHES[field];
    const plugin = plugins.find((item) => item.id === id);
    if (typeof stored !== "boolean" || !plugin) continue;
    result.migrated.push(field);
    if (!stored && plugin.enabled) result.switch.push([id, false]);
  }
  return result;
}
