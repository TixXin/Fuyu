import type { ComponentType } from "react";
import { BUILTIN, createSlots, SlotError, slotWindow, type SlotItem, type SlotRegistry, type SlotRule } from "@fuyu/plugin-base/client/slots";
import { SLOTS, type SlotName } from "@fuyu/plugin-base/protocol";
import type { Translations } from "../../i18n";
import { disabledBuiltinIds, subscribeBuiltinPlugins } from "./builtinSwitches.ts";
import { installIpcLedger, type IpcInternals } from "./ipcLedger.ts";
import type { SlotTitle } from "./slotTitle.ts";

export type { SlotName };
export type SlotWindow = "island" | "settings" | "plugin-window";

export type SlotInput<Props extends object, Meta extends object> = Meta & {
  id: string;
  order?: number;
  component: ComponentType<Props>;
};

export type SlotEntry<Props extends object, Meta extends object> = SlotInput<Props, Meta> & {
  order: number;
  owner: string;
  seq: number;
  external: boolean;
  replaces: readonly string[];
};

export interface SlotHandle<Props extends object, Meta extends object> {
  readonly name: SlotName;
  readonly registry: SlotRegistry;
  add(item: SlotInput<Props, Meta>, owner?: string): () => void;
  items(group?: string): readonly SlotEntry<Props, Meta>[];
}

export type SlotIcon = ComponentType<{ size?: number | string; strokeWidth?: number | string; absoluteStrokeWidth?: boolean; className?: string }>;
export type SlotWidth<Context = unknown> = number | ((context: Context) => number);

export interface IslandPageMeta<Features = unknown, Page extends string = string> {
  title?: SlotTitle;
  icon?: SlotIcon;
  shortcutOrder?: number;
  headerDot?: boolean;
  enabled?: (features: Features) => boolean;
  fallback?: (features: Features) => Page | null;
  fold?: IslandPageFold<Features, Page>;
}

export interface IslandPageFold<Features = unknown, Page extends string = string> {
  into: Page;
  when: (features: Features) => boolean;
  label: (t: Translations) => string;
}

export interface IslandHeaderMeta<Features = unknown> {
  enabled?: (features: Features) => boolean;
}

export interface IslandCollapsedMeta<Context = unknown> {
  group?: "gauges";
  width?: SlotWidth<Context>;
  hideable?: boolean;
  shown?: (context: Context) => boolean;
  opens?: string;
}

export interface IslandCollapsedCenterMeta<Context = unknown> {
  width?: SlotWidth<Context>;
  shown?: (context: Context) => boolean;
}

export interface IslandAlertMeta<Sources = unknown> {
  trailing?: ComponentType<Sources>;
  popup: ComponentType<Sources>;
}

export interface IslandNoticeMeta<Sources = unknown> {
  active?: (sources: Sources) => boolean;
  actions: ComponentType<Sources>;
}

export interface SettingsCategoryMeta<Context = unknown, Group extends string = string, Category extends string = string> {
  group?: Group | null;
  icon?: SlotIcon;
  tabs?: readonly Category[];
  parent?: Category;
  available?: (context: Context) => boolean;
  feature?: string;
  aliases?: readonly string[];
}

export interface SettingsSectionMeta<Category extends string = string> {
  category: Category;
}

export interface PluginWindowViewMeta {
  windowId?: string;
  title?: string;
}

const SLOT_NAMES = Object.keys(SLOTS) as SlotName[];

function rulesOf(window: SlotWindow): Record<string, SlotRule> {
  return Object.fromEntries(SLOT_NAMES.filter((name) => slotWindow(name) === window).map((name) => [name, SLOTS[name]]));
}

const registries: Record<SlotWindow, SlotRegistry> = {
  island: createSlots(rulesOf("island")),
  settings: createSlots(rulesOf("settings")),
  "plugin-window": createSlots(rulesOf("plugin-window")),
};

export function windowSlots(window: SlotWindow): SlotRegistry {
  return registries[window];
}

export function followBuiltinSwitches(registry: SlotRegistry): () => void {
  return subscribeBuiltinPlugins((plugins) => registry.setDisabledOwners(disabledBuiltinIds(plugins)));
}

function startDiagnostics() {
  const internals = (window as unknown as { __TAURI_INTERNALS__?: IpcInternals }).__TAURI_INTERNALS__;
  if (!internals || typeof internals.invoke !== "function") return;
  const ledger = installIpcLedger(internals);
  if (!ledger.recording) console.warn("Built-in plugin diagnostics cannot count commands and listeners here: invoke is read-only");
  void Promise.all([import("./diagnostics.ts"), import("./services.ts")])
    .then(([{ answerBuiltinDiagnostics }, { windowServices }]) => answerBuiltinDiagnostics(ledger, Object.values(registries), windowServices))
    .catch((error: unknown) => console.error("Could not start the built-in plugin diagnostics", error));
}

if (typeof window !== "undefined") {
  for (const registry of Object.values(registries)) followBuiltinSwitches(registry);
  // eslint-disable-next-line no-restricted-syntax
  if (import.meta.env.DEV) {
    try {
      startDiagnostics();
    } catch (error) {
      console.error("Could not start the built-in plugin diagnostics", error);
    }
  }
}

export function slotWindowOf(name: SlotName): SlotWindow {
  return slotWindow(name) as SlotWindow;
}

export function defineSlot<Props extends object, Meta extends object = Record<never, never>>(name: SlotName, registry: SlotRegistry = windowSlots(slotWindowOf(name))): SlotHandle<Props, Meta> {
  if (!registry.names().includes(name)) throw new SlotError("no-slot", `there is no slot ${name}`);
  return {
    name,
    registry,
    add: (item, owner = BUILTIN) => registry.add(name, item, owner, { external: false }),
    items: (group) => registry.items(name, group) as SlotItem[] as unknown as SlotEntry<Props, Meta>[],
  };
}

export interface SlotFailure {
  slot: string;
  id: string;
  owner: string;
  external: boolean;
  error: unknown;
}

export function reportSlotError({ slot, id, owner, external, error }: SlotFailure) {
  console.error(`[slot ${slot}] ${external ? "plugin" : "built-in"} item ${id} from ${owner} failed and was taken out`, error);
}
