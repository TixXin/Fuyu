import type { ComponentType, ReactNode } from "react";
import type { SlotItem, SlotRegistry } from "./slots.mjs";

export function useSlotItems(registry: SlotRegistry, name: string): SlotItem[];
export function SlotItems<P extends object>(props: {
  registry: SlotRegistry;
  name: string;
  props?: P;
  fallback?: (error: unknown, item: SlotItem) => ReactNode;
  onError?: (item: SlotItem, error: unknown) => void;
}): ReactNode;
export function installShared(modules: { react?: unknown; jsxRuntime?: unknown; [name: string]: unknown }): void;
export type { ComponentType };
