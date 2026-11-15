export interface SlotRule {
  kind?: "single" | "list";
  max?: number;
  perPlugin?: number;
}

export interface SlotItemInput {
  id: string;
  order?: number;
  component: unknown;
  [key: string]: unknown;
}

export interface SlotItem extends SlotItemInput {
  order: number;
  owner: string;
  seq: number;
  replaces?: string;
}

export interface SlotRegistry {
  define(name: string, rule?: SlotRule): void;
  add(name: string, item: SlotItemInput, owner: string): () => void;
  items(name: string): SlotItem[];
  names(): string[];
  subscribe(listener: (name: string) => void): () => void;
}

export declare class SlotError extends Error {
  code: "no-slot" | "bad-item" | "too-many";
}

export function createSlots(definitions?: Record<string, SlotRule>): SlotRegistry;
