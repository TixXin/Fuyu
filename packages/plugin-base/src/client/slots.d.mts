export interface SlotRule {
  kind?: "single" | "list";
  max?: number;
  perPlugin?: number;
  groupBy?: string;
  meta?: readonly string[];
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
  external: boolean;
  replaces: string[];
}

export interface SlotAddOptions {
  external?: boolean;
}

export interface SlotRegistry {
  define(name: string, rule?: SlotRule): void;
  add(name: string, item: SlotItemInput, owner?: string, options?: SlotAddOptions): () => void;
  items(name: string, group?: string): SlotItem[];
  setDisabledOwners(owners: Iterable<string>): void;
  disabledOwners(): string[];
  names(): string[];
  rule(name: string): Required<Pick<SlotRule, "kind" | "max" | "perPlugin">> & SlotRule | undefined;
  subscribe(listener: (name: string) => void): () => void;
}

export type SlotErrorCode = "no-slot" | "bad-name" | "bad-rule" | "bad-item" | "too-many";

export declare class SlotError extends Error {
  constructor(code: SlotErrorCode, message: string);
  code: SlotErrorCode;
}

export declare const BUILTIN: "builtin";

export function slotWindow(name: string): string | null;

export function createSlots(definitions?: Record<string, SlotRule>): SlotRegistry;
