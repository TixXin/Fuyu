import { isMacOS } from "../../lib/platform.ts";
import type { ClipboardHistoryItem } from "./api";
import { moveIndex } from "./linkRules.ts";

export const PIN_KEYS: readonly string[] = "ABCDFGHJKLMOPQRSTVWXYZ".split("");

export type PinnedLayout = { items: ClipboardHistoryItem[]; pinned: number };

const byPinOrder = (a: ClipboardHistoryItem, b: ClipboardHistoryItem) => {
  const left = a.pinOrder ?? Number.POSITIVE_INFINITY;
  const right = b.pinOrder ?? Number.POSITIVE_INFINITY;
  return left === right ? b.copiedAt - a.copiedAt : left - right;
};

export function pinnedItems(items: readonly ClipboardHistoryItem[]): ClipboardHistoryItem[] {
  return items.filter((item) => item.favorite).sort(byPinOrder);
}

export function pinnedLayout(items: readonly ClipboardHistoryItem[], enabled: boolean): PinnedLayout {
  if (!enabled) return { items: [...items], pinned: 0 };
  const pinned = pinnedItems(items);
  return { items: [...pinned, ...items.filter((item) => !item.favorite)], pinned: pinned.length };
}

export function pinKeyFromCode(code: string | undefined): string | null {
  const match = /^Key([A-Z])$/.exec(code ?? "");
  return match && PIN_KEYS.includes(match[1]) ? match[1] : null;
}

export function itemForPinKey(items: readonly ClipboardHistoryItem[], key: string | null): ClipboardHistoryItem | undefined {
  return key ? items.find((item) => item.favorite && item.pinKey === key) : undefined;
}

export function pinOwners(items: readonly ClipboardHistoryItem[]): Map<string, ClipboardHistoryItem> {
  const owners = new Map<string, ClipboardHistoryItem>();
  for (const item of items) if (item.favorite && item.pinKey) owners.set(item.pinKey, item);
  return owners;
}

export function movedPinOrder(pinned: readonly ClipboardHistoryItem[], from: number, to: number): string[] | null {
  if (from === to || from < 0 || from >= pinned.length || to < 0 || to >= pinned.length) return null;
  return moveIndex(pinned, from, to).map((item) => item.id);
}

export function digitSlot(index: number, pinned: number): number | null {
  const slot = index - pinned;
  return slot >= 0 && slot < 9 ? slot : null;
}

export const ALT_KEY = isMacOS ? "⌥" : "Alt+";
