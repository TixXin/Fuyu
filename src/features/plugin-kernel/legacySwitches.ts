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
  switch: { field: LegacySwitch; id: string; on: boolean }[];
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
    if (!stored && plugin.enabled) result.switch.push({ field, id, on: false });
    else result.migrated.push(field);
  }
  return result;
}

export interface LegacyMigrationStore {
  load: () => ReadonlySet<string>;
  save: (fields: Iterable<string>) => void;
  switchPlugin: (id: string, on: boolean) => Promise<unknown>;
  onError?: (id: string, error: unknown) => void;
}

export async function runLegacyMigration(
  settings: Partial<Record<LegacySwitch, boolean>>,
  plugins: readonly BuiltinPlugin[],
  store: LegacyMigrationStore,
  tried: Set<string>,
): Promise<void> {
  const result = migrateLegacySwitches(settings, plugins, store.load());
  const mark = (fields: readonly string[]) => store.save([...store.load(), ...fields]);
  if (result.migrated.length > 0) mark(result.migrated);
  const pending = result.switch.filter(({ field }) => !tried.has(field));
  for (const { field } of pending) tried.add(field);
  await Promise.all(
    pending.map(async ({ field, id, on }) => {
      try {
        await store.switchPlugin(id, on);
        mark([field]);
      } catch (error) {
        store.onError?.(id, error);
      }
    }),
  );
}
