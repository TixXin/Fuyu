import type { ComponentType, ReactNode } from "react";
import type { SlotItem, SlotRegistry } from "./slots.mjs";

export interface SlotItemError {
  slot: string;
  id: string;
  owner: string;
  external: boolean;
  error: unknown;
}

export function useSlotItems(registry: SlotRegistry, name: string, group?: string): SlotItem[];
export function SlotItems<P extends object>(props: {
  registry: SlotRegistry;
  name: string;
  group?: string;
  props?: P;
  select?: (items: SlotItem[]) => readonly SlotItem[];
  wrap?: (item: SlotItem, node: ReactNode) => ReactNode;
  fallback?: (error: unknown, item: SlotItem) => ReactNode;
  onError?: (failure: SlotItemError) => void;
}): ReactNode;
export function installShared(modules: { react?: unknown; jsxRuntime?: unknown; [name: string]: unknown }): void;
export type { ComponentType };
